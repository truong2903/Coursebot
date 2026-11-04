package com.courseregistration.service;

import com.courseregistration.dto.CourseSectionDto;
import com.courseregistration.entity.CourseSection;
import com.courseregistration.entity.Enrollment;
import com.courseregistration.entity.RegistrationPeriod;
import com.courseregistration.entity.Semester;
import com.courseregistration.entity.Student;
import com.courseregistration.entity.WaitlistEntry;
import com.courseregistration.repository.CourseSectionRepository;
import com.courseregistration.repository.EnrollmentRepository;
import com.courseregistration.repository.RegistrationPeriodRepository;
import com.courseregistration.repository.SemesterRepository;
import com.courseregistration.repository.WaitlistRepository;
import com.courseregistration.service.policy.CourseConditionEvaluator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CourseService {
    private final CourseSectionRepository sectionRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final WaitlistRepository waitlistRepository;
    private final AuthService authService;
    private final SemesterRepository semesterRepository;
    private final RegistrationPeriodRepository registrationPeriods;
    private final CourseConditionEvaluator conditionEvaluator;

    public CourseService(CourseSectionRepository sectionRepository,
                         EnrollmentRepository enrollmentRepository,
                         WaitlistRepository waitlistRepository,
                         AuthService authService,
                         SemesterRepository semesterRepository,
                         RegistrationPeriodRepository registrationPeriods,
                         CourseConditionEvaluator conditionEvaluator) {
        this.sectionRepository = sectionRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.waitlistRepository = waitlistRepository;
        this.authService = authService;
        this.semesterRepository = semesterRepository;
        this.registrationPeriods = registrationPeriods;
        this.conditionEvaluator = conditionEvaluator;
    }

    @Transactional(readOnly = true)
    public List<CourseSectionDto> listOpenSections() {
        Student student = authService.currentStudent();
        Semester semester = currentSemester();
        String semesterCode = semester.getCode();
        var activeEnrollments = enrollmentRepository
                .findAllByStudentAndSection_Semester_CodeAndStatusOrderByEnrolledAtAsc(student, semesterCode, Enrollment.Status.ENROLLED);
        Set<String> registeredIds = activeEnrollments.stream().map(e -> e.getSection().getId()).collect(Collectors.toSet());
        Set<String> activeCourseCodes = activeEnrollments.stream().map(e -> e.getSection().getCourse().getCode()).collect(Collectors.toSet());
        var rulesByCourse = conditionEvaluator.allRulesByCourse();
        var priorStudied = conditionEvaluator.priorStudiedCodes(student, semester);
        var counts = enrollmentRepository.activeCountsBySection().stream()
                .collect(Collectors.toMap(r -> (String) r[0], r -> ((Number) r[1]).longValue()));
        var waitingIds = waitlistRepository.findAllByStudentAndStatus(student, WaitlistEntry.Status.WAITING).stream()
                .map(w -> w.getSection().getId()).collect(Collectors.toSet());
        return sectionRepository.findAllBySemester_CodeOrderBySectionCode(semesterCode).stream()
                .filter(section -> section.getStatus() == CourseSection.Status.OPEN && section.getCourse().isActive())
                .map(section -> {
                    var unmet = conditionEvaluator.findUnmetConditions(
                            section.getCourse(), student, activeCourseCodes, rulesByCourse, priorStudied);
                    return buildDto(section, registeredIds.contains(section.getId()), student,
                            counts.getOrDefault(section.getId(), 0L), waitingIds.contains(section.getId()), unmet);
                }).toList();
    }

    @Transactional(readOnly = true)
    public List<CourseSectionDto> listRegisteredSections(Student student) {
        String semesterCode = currentSemester().getCode();
        return enrollmentRepository
                .findAllByStudentAndSection_Semester_CodeAndStatusOrderByEnrolledAtAsc(student, semesterCode, Enrollment.Status.ENROLLED)
                .stream()
                .map(Enrollment::getSection)
                .map(section -> buildDto(section, true, student,
                        enrollmentRepository.countBySection_IdAndStatus(section.getId(), Enrollment.Status.ENROLLED),
                        false, List.of()))
                .toList();
    }

    @Transactional(readOnly = true)
    public CourseSection findSection(String id) {
        return sectionRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lớp học phần."));
    }

    @Transactional
    public CourseSection findSectionForUpdate(String id) {
        return sectionRepository.findByIdForUpdate(id).orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lớp học phần."));
    }

    @Transactional(readOnly = true)
    public CourseSectionDto getSection(String id) {
        Student student = authService.currentStudent();
        CourseSection section = findSection(id);
        boolean registered = enrollmentRepository.existsByStudentAndSectionAndStatus(student, section, Enrollment.Status.ENROLLED);
        return toDto(section, registered);
    }

    @Transactional(readOnly = true)
    public Semester currentSemester() {
        var manual = semesterRepository.findFirstByRegistrationAlwaysOpenTrueAndStatusOrderByCodeDesc(Semester.Status.ACTIVE);
        if (manual.isPresent()) return manual.get();
        var now = java.time.LocalDateTime.now();
        var activePeriod = registrationPeriods.findFirstByStartsAtLessThanEqualAndEndsAtGreaterThanEqualAndStatusIn(
                now, now, java.util.List.of(RegistrationPeriod.Status.SCHEDULED, RegistrationPeriod.Status.OPEN));
        if (activePeriod.isPresent()) return activePeriod.get().getSemester();
        var activeSemester = semesterRepository.findFirstByStatusOrderByStartsAtDesc(Semester.Status.ACTIVE);
        if (activeSemester.isPresent()) return activeSemester.get();
        var today = java.time.LocalDate.now();
        return semesterRepository.findFirstByRegistrationOpenAtLessThanEqualAndRegistrationCloseAtGreaterThanEqual(today, today)
                .or(() -> semesterRepository.findAllByOrderByStartsAtDesc().stream().findFirst())
                .orElseThrow(() -> new IllegalStateException("Chưa có học kỳ nào được khai báo."));
    }

    @Transactional(readOnly = true)
    public boolean registrationOpen(Semester semester) {
        if (semester.getStatus() == Semester.Status.ARCHIVED || semester.getStatus() == Semester.Status.COMPLETED) return false;
        if (semester.isRegistrationAlwaysOpen()) return true;
        var period = registrationPeriods.findBySemester_Code(semester.getCode());
        if (period.isPresent()) return period.get().getEffectiveStatus() == RegistrationPeriod.Status.OPEN;
        return semester.getRegistrationOpenAt() != null
                && semester.getRegistrationCloseAt() != null
                && !java.time.LocalDate.now().isBefore(semester.getRegistrationOpenAt())
                && !java.time.LocalDate.now().isAfter(semester.getRegistrationCloseAt());
    }

    @Transactional(readOnly = true)
    public CourseSectionDto toDto(CourseSection section, boolean registered) {
        Student student = authService.currentStudent();
        boolean waitlisted = waitlistRepository.existsByStudentAndSectionAndStatus(student, section, WaitlistEntry.Status.WAITING);
        List<CourseConditionEvaluator.UnmetCondition> unmet = List.of();
        if (!registered) {
            Set<String> activeCourseCodes = enrollmentRepository
                    .findAllByStudentAndSection_Semester_CodeAndStatusOrderByEnrolledAtAsc(
                            student, section.getSemester().getCode(), Enrollment.Status.ENROLLED)
                    .stream().map(e -> e.getSection().getCourse().getCode()).collect(Collectors.toSet());
            unmet = conditionEvaluator.findUnmetConditions(
                    section.getCourse(), student, section.getSemester(), activeCourseCodes);
        }
        return buildDto(section, registered, student,
                enrollmentRepository.countBySection_IdAndStatus(section.getId(), Enrollment.Status.ENROLLED),
                waitlisted, unmet);
    }

    private CourseSectionDto buildDto(CourseSection section, boolean registered, Student student,
                                      long localEnrolled, boolean waitlisted,
                                      List<CourseConditionEvaluator.UnmetCondition> unmet) {
        int enrolled = section.totalEnrolled(localEnrolled);
        boolean conditionsMet = unmet.isEmpty();
        String blockReason = conditionEvaluator.shortBadgeLabel(unmet);
        String unmetMessage = conditionEvaluator.formatViolationMessage(section.getCourse(), unmet).orElse(null);
        int waitlistPosition = 0;
        if (waitlisted) {
            var queue = waitlistRepository.findAllBySectionAndStatusOrderByCreatedAtAscIdAsc(section, WaitlistEntry.Status.WAITING);
            for (int i = 0; i < queue.size(); i++) {
                if (queue.get(i).getStudent().getId().equals(student.getId())) { waitlistPosition = i + 1; break; }
            }
        }
        return CourseSectionDto.from(section, enrolled, section.getCourse().getPrerequisite(), registered,
                conditionsMet, waitlisted, waitlistPosition, blockReason, unmetMessage);
    }
}
