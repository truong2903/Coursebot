package com.courseregistration.service;

import com.courseregistration.dto.CourseSectionDto;
import com.courseregistration.dto.EnrollmentHistoryDto;
import com.courseregistration.entity.CourseSection;
import com.courseregistration.entity.Enrollment;
import com.courseregistration.entity.Student;
import com.courseregistration.entity.WaitlistEntry;
import com.courseregistration.repository.EnrollmentRepository;
import com.courseregistration.repository.RegistrationPeriodRepository;
import com.courseregistration.repository.WaitlistRepository;
import com.courseregistration.service.policy.CourseConditionEvaluator;
import com.courseregistration.service.policy.CreditLimitRule;
import com.courseregistration.service.policy.DuplicateEnrollmentRule;
import com.courseregistration.service.policy.EnrollmentRule;
import com.courseregistration.service.policy.EnrollmentValidationContext;
import com.courseregistration.service.policy.PrerequisiteRule;
import com.courseregistration.service.policy.ScheduleConflictRule;
import com.courseregistration.service.policy.SectionAvailabilityRule;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;

@Service
public class EnrollmentService {
    private final int maxCredits;
    private final int dropWindowDays;
    private final EnrollmentRepository enrollmentRepository;
    private final WaitlistRepository waitlistRepository;
    private final CourseService courseService;
    private final AuthService authService;
    private final RegistrationPeriodRepository registrationPeriods;
    private final AuditService audit;
    private final List<EnrollmentRule> rules;
    private final CourseConditionEvaluator conditionEvaluator;

    @Autowired
    public EnrollmentService(EnrollmentRepository enrollmentRepository,
                             WaitlistRepository waitlistRepository,
                             CourseService courseService,
                             AuthService authService,
                             RegistrationPeriodRepository registrationPeriods,
                             AuditService audit,
                             List<EnrollmentRule> rules,
                             CourseConditionEvaluator conditionEvaluator,
                             @Value("${app.enrollment.max-credits:20}") int maxCredits,
                             @Value("${app.enrollment.drop-window-days:7}") int dropWindowDays) {
        this.enrollmentRepository = enrollmentRepository;
        this.waitlistRepository = waitlistRepository;
        this.courseService = courseService;
        this.authService = authService;
        this.registrationPeriods = registrationPeriods;
        this.audit = audit;
        this.rules = List.copyOf(rules);
        this.conditionEvaluator = conditionEvaluator;
        this.maxCredits = maxCredits;
        this.dropWindowDays = dropWindowDays;
    }

    public EnrollmentService(EnrollmentRepository enrollmentRepository,
                             WaitlistRepository waitlistRepository,
                             CourseService courseService,
                             AuthService authService,
                             RegistrationPeriodRepository registrationPeriods,
                             AuditService audit,
                             int maxCredits,
                             int dropWindowDays) {
        this(enrollmentRepository, waitlistRepository, courseService, authService,
                registrationPeriods, audit, defaultRules(courseService, maxCredits), null, maxCredits, dropWindowDays);
    }

    public static List<EnrollmentRule> defaultRules(CourseService courseService, int maxCredits) {
        return List.of(
                new SectionAvailabilityRule(courseService),
                new DuplicateEnrollmentRule(),
                new CreditLimitRule(maxCredits),
                new PrerequisiteRule(),
                new ScheduleConflictRule()
        );
    }

    @Transactional(readOnly = true)
    public List<CourseSectionDto> registeredSections() { return courseService.listRegisteredSections(authService.currentStudent()); }

    @Transactional(readOnly = true)
    public List<EnrollmentHistoryDto> history() {
        Student student = authService.currentStudent();
        return enrollmentRepository.findAllByStudentOrderByEnrolledAtDesc(student).stream()
                .map(EnrollmentHistoryDto::from).toList();
    }

    @Transactional(readOnly = true)
    public int currentCredits() {
        return registeredSections().stream().mapToInt(CourseSectionDto::credits).sum();
    }
    public int maxCredits() { return maxCredits; }
    public int dropWindowDays() { return dropWindowDays; }
    public List<EnrollmentRule> rules() { return rules; }

    @Transactional
    public String enroll(String sectionId) {
        Student student = authService.currentStudent();
        CourseSection section = courseService.findSectionForUpdate(sectionId);
        var existingEnrollment = enrollmentRepository.findByStudentAndSection(student, section);
        boolean alreadyEnrolled = existingEnrollment.isPresent()
                && existingEnrollment.get().getStatus() == Enrollment.Status.ENROLLED;
        var existing = enrollmentRepository
                .findAllByStudentAndSection_Semester_CodeAndStatusOrderByEnrolledAtAsc(
                        student, section.getSemester().getCode(), Enrollment.Status.ENROLLED)
                .stream().map(Enrollment::getSection).toList();
        var context = new EnrollmentValidationContext(student, section, existing, alreadyEnrolled, true);
        for (EnrollmentRule rule : rules) {
            rule.validate(context);
        }
        if (section.totalEnrolled(enrollmentRepository.countBySection_IdAndStatus(sectionId, Enrollment.Status.ENROLLED)) >= section.getCapacity()) {
            var waitEntry = waitlistRepository.findByStudentAndSection(student, section);
            if (waitEntry.isPresent() && waitEntry.get().getStatus() == WaitlistEntry.Status.WAITING)
                throw new IllegalStateException("Bạn đang ở vị trí " + waitlistPosition(waitEntry.get()) + " trong danh sách chờ.");
            if (waitEntry.isPresent()) waitEntry.get().rejoin();
            else waitEntry = java.util.Optional.of(new WaitlistEntry(student, section));
            waitlistRepository.save(waitEntry.get());
            audit.record("WAITLIST_JOINED", section.getSectionCode(), "Thêm vào danh sách chờ học phần " + section.getCourse().getCode());
            return "Lớp đã đủ chỗ. Bạn được thêm vào danh sách chờ, vị trí " + waitlistPosition(waitEntry.get()) + ".";
        }
        if (existingEnrollment.isPresent()) existingEnrollment.get().reEnroll();
        else enrollmentRepository.save(new Enrollment(student, section));
        audit.record("ENROLLMENT_CREATED", section.getSectionCode(), "Đăng ký học phần " + section.getCourse().getCode());
        return "Đăng ký " + section.getCourse().getCode() + " thành công!";
    }

    @Transactional
    public String drop(String sectionId) {
        Student student = authService.currentStudent();
        CourseSection section = courseService.findSectionForUpdate(sectionId);
        var startsAt = section.getSemester().getStartsAt();
        if (startsAt == null && !section.getSemester().isRegistrationAlwaysOpen())
            throw new IllegalStateException("Học kỳ chưa có ngày bắt đầu. Vui lòng liên hệ Ban Đào tạo để duyệt hủy.");
        if (startsAt != null && !LocalDate.now().isBefore(startsAt.plusDays(dropWindowDays)))
            throw new IllegalStateException("Đã quá " + dropWindowDays + " ngày đầu học kỳ. Vui lòng liên hệ Phòng Đào tạo để được duyệt hủy.");
        Enrollment enrollment = enrollmentRepository.findByStudentAndSectionAndStatus(student, section, Enrollment.Status.ENROLLED)
                .orElseThrow(() -> new IllegalArgumentException("Học phần này chưa nằm trong danh sách đăng ký."));
        if (conditionEvaluator != null) {
            var activeSections = enrollmentRepository
                    .findAllByStudentAndSection_Semester_CodeAndStatusOrderByEnrolledAtAsc(
                            student, section.getSemester().getCode(), Enrollment.Status.ENROLLED)
                    .stream().map(Enrollment::getSection).toList();
            conditionEvaluator.checkCorequisiteDropViolation(student, section, activeSections)
                    .ifPresent(message -> { throw new IllegalStateException(message); });
        }
        enrollment.cancel();
        audit.record("ENROLLMENT_CANCELLED", section.getSectionCode(), "Hủy đăng ký học phần " + section.getCourse().getCode());
        var queue = waitlistRepository.findAllBySectionAndStatusOrderByCreatedAtAscIdAsc(section, WaitlistEntry.Status.WAITING);
        if (section.getStatus() == CourseSection.Status.OPEN && !section.isScheduleReviewRequired()
                && courseService.registrationOpen(section.getSemester())
                && section.totalEnrolled(enrollmentRepository.countBySection_IdAndStatus(sectionId, Enrollment.Status.ENROLLED)) < section.getCapacity()) {
            for (WaitlistEntry next : queue) {
                if (!canPromote(next.getStudent(), section)) continue;
                next.promote();
                Student nextStudent = next.getStudent();
                var previousEnrollment = enrollmentRepository.findByStudentAndSection(nextStudent, section);
                if (previousEnrollment.isPresent()) previousEnrollment.get().reEnroll();
                else enrollmentRepository.save(new Enrollment(nextStudent, section));
                return "Đã hủy học phần " + section.getCourse().getCode() + ". Sinh viên tiếp theo trong danh sách chờ đã được thêm vào lớp.";
            }
        }
        return "Đã hủy học phần " + section.getCourse().getCode() + ".";
    }

    @Transactional
    public String leaveWaitlist(String sectionId) {
        Student student = authService.currentStudent();
        CourseSection section = courseService.findSectionForUpdate(sectionId);
        WaitlistEntry entry = waitlistRepository.findByStudentAndSection(student, section)
                .filter(item -> item.getStatus() == WaitlistEntry.Status.WAITING)
                .orElseThrow(() -> new IllegalArgumentException("Bạn không có tên trong danh sách chờ của lớp này."));
        entry.cancel();
        audit.record("WAITLIST_LEFT", section.getSectionCode(), "Rời danh sách chờ học phần " + section.getCourse().getCode());
        return "Đã rời danh sách chờ lớp " + section.getCourse().getCode() + ".";
    }

    private int waitlistPosition(WaitlistEntry entry) {
        var queue = waitlistRepository.findAllBySectionAndStatusOrderByCreatedAtAscIdAsc(entry.getSection(), WaitlistEntry.Status.WAITING);
        for (int i = 0; i < queue.size(); i++) if (queue.get(i).getId().equals(entry.getId())) return i + 1;
        return 0;
    }

    private boolean canPromote(Student student, CourseSection section) {
        var existing = enrollmentRepository
                .findAllByStudentAndSection_Semester_CodeAndStatusOrderByEnrolledAtAsc(
                        student, section.getSemester().getCode(), Enrollment.Status.ENROLLED)
                .stream().map(Enrollment::getSection).toList();
        var context = new EnrollmentValidationContext(student, section, existing, false, false);
        return rules.stream().allMatch(rule -> rule.checkViolation(context).isEmpty());
    }
}
