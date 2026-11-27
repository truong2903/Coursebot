package com.courseregistration.service;

import com.courseregistration.dto.*;
import com.courseregistration.entity.CourseSection;
import com.courseregistration.entity.Enrollment;
import com.courseregistration.entity.Semester;
import com.courseregistration.entity.WaitlistEntry;
import com.courseregistration.entity.RegistrationPeriod;
import com.courseregistration.repository.*;
import com.courseregistration.service.AuthService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Role-specific, read-only workspace summaries. Authorization is enforced by Spring Security. */
@Service
public class WorkspaceService {
    private final LecturerRepository lecturerRepository;
    private final StudentRepository studentRepository;
    private final CourseRepository courseRepository;
    private final CourseSectionRepository sectionRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final SemesterRepository semesterRepository;
    private final WaitlistRepository waitlistRepository;
    private final AuthService authService;
    private final RegistrationPeriodRepository registrationPeriods;
    private final UserAccountRepository accounts;
    private final AuditService audit;

    @org.springframework.beans.factory.annotation.Autowired
    public WorkspaceService(LecturerRepository lecturerRepository, StudentRepository studentRepository,
                              CourseRepository courseRepository, CourseSectionRepository sectionRepository,
                              EnrollmentRepository enrollmentRepository, SemesterRepository semesterRepository,
                              WaitlistRepository waitlistRepository, AuthService authService,
                              RegistrationPeriodRepository registrationPeriods, UserAccountRepository accounts,
                              AuditService audit) {
        this.lecturerRepository = lecturerRepository; this.studentRepository = studentRepository;
        this.courseRepository = courseRepository; this.sectionRepository = sectionRepository;
        this.enrollmentRepository = enrollmentRepository; this.semesterRepository = semesterRepository;
        this.waitlistRepository = waitlistRepository;
        this.authService = authService;
        this.registrationPeriods = registrationPeriods; this.accounts = accounts;
        this.audit = audit;
    }

    public WorkspaceService(LecturerRepository lecturerRepository, StudentRepository studentRepository,
                              CourseRepository courseRepository, CourseSectionRepository sectionRepository,
                              EnrollmentRepository enrollmentRepository, SemesterRepository semesterRepository,
                              WaitlistRepository waitlistRepository, AuthService authService,
                              RegistrationPeriodRepository registrationPeriods, UserAccountRepository accounts) {
        this(lecturerRepository, studentRepository, courseRepository, sectionRepository,
                enrollmentRepository, semesterRepository, waitlistRepository, authService,
                registrationPeriods, accounts, null);
    }

    @Transactional(readOnly = true)
    public LecturerDashboardDto lecturerDashboard(String semesterCode) {
        var lecturer = authService.currentLecturer();
        Semester semester = semesterCode==null||semesterCode.isBlank()?currentSemester():semesterRepository.findByCodeIgnoreCase(semesterCode).orElseThrow(()->new IllegalArgumentException("Không tìm thấy học kỳ."));
        List<LecturerSectionDto> sections = sectionRepository.findAllBySemester_CodeOrderBySectionCode(semester.getCode())
                .stream().filter(section -> section.getLecturer()!=null&&section.getLecturer().getId().equals(lecturer.getId()))
                .map(this::lecturerSection).toList();
        int students = sections.stream().mapToInt(LecturerSectionDto::studentCount).sum();
        return new LecturerDashboardDto("Giảng viên", lecturer.getFullName(), lecturer.getLecturerCode(),
                semester.getCode(), semester.getName(), students, sections);
    }

    @Transactional(readOnly = true)
    public List<RosterStudentDto> classRoster(String sectionId) {
        var lecturer = authService.currentLecturer();
        CourseSection section = sectionRepository.findById(sectionId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lớp học phần."));
        if (section.getLecturer()==null||!section.getLecturer().getId().equals(lecturer.getId()))
            throw new IllegalArgumentException("Lớp học phần này không thuộc lịch giảng dạy của bạn.");
        return enrollmentRepository.findAllBySectionAndStatusOrderByEnrolledAtAsc(section, Enrollment.Status.ENROLLED)
                .stream().map(enrollment -> enrollment.getStudent())
                .map(student -> new RosterStudentDto(student.getStudentCode(), student.getFullName(), student.getProgram(), student.getEmail(), "ENROLLED"))
                .toList();
    }

    @Transactional(readOnly = true)
    public SectionDetailDto lecturerSectionDetails(String sectionId) {
        var lecturer=authService.currentLecturer();
        CourseSection section=sectionRepository.findById(sectionId).orElseThrow(()->new IllegalArgumentException("Không tìm thấy lớp học phần."));
        if(section.getLecturer()==null||!section.getLecturer().getId().equals(lecturer.getId()))throw new IllegalArgumentException("Lớp học phần này không thuộc lịch giảng dạy của bạn.");
        var course=section.getCourse();int enrolled=section.totalEnrolled(enrollmentRepository.countBySection_IdAndStatus(sectionId,Enrollment.Status.ENROLLED));
        return new SectionDetailDto(section.getId(),section.getSectionCode(),course.getCode(),course.getName(),course.getCredits(),section.getSemester().getName(),
                lecturer.getFullName(),section.getSchedule(),section.getRoom(),section.getCapacity(),enrolled,Math.max(0,section.getCapacity()-enrolled),section.getStatus().name(),
                course.getPrerequisite(),course.getDescription(),course.getSyllabusUrl(),section.getEffectiveMeetings().stream().map(MeetingDto::from).toList());
    }

    @Transactional(readOnly = true)
    public List<SemesterManagementDto> lecturerSemesters() {
        authService.currentLecturer();
        return semesterRepository.findAllByOrderByStartsAtDesc().stream().map(SemesterManagementDto::from).toList();
    }

    @Transactional(readOnly = true)
    public LecturerPublicProfileDto lecturerOwnProfile() {
        var lecturer = authService.currentLecturer();
        return LecturerPublicProfileDto.forSelf(lecturer, lecturerTeachingSections(lecturer.getId()));
    }

    @Transactional
    public LecturerPublicProfileDto updateLecturerOwnProfile(LecturerProfileUpdateRequest req) {
        if (req == null) throw new IllegalArgumentException("Thiếu dữ liệu cập nhật hồ sơ.");
        var lecturer = authService.currentLecturer();

        validateMaxLen(req.bio(), 1200, "Giới thiệu bản thân");
        validateMaxLen(req.researchInterests(), 500, "Hướng nghiên cứu / chuyên môn");
        validateMaxLen(req.officeLocation(), 160, "Phòng làm việc");
        validateMaxLen(req.officeHours(), 240, "Giờ tiếp sinh viên");
        validateMaxLen(req.websiteUrl(), 300, "Liên kết học thuật");
        validateMaxLen(req.email(), 160, "Email liên hệ");
        validateMaxLen(req.phone(), 30, "Số điện thoại");

        if (req.websiteUrl() != null && !req.websiteUrl().isBlank()) {
            String trimmedUrl = req.websiteUrl().trim();
            try {
                var uri = java.net.URI.create(trimmedUrl);
                String scheme = uri.getScheme();
                if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) {
                    throw new IllegalArgumentException("Liên kết học thuật phải bắt đầu bằng http:// hoặc https://.");
                }
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("Liên kết học thuật không hợp lệ (phải bắt đầu bằng http:// hoặc https://).");
            }
        }

        lecturer.updatePublicProfile(
                req.bio(),
                req.researchInterests(),
                req.officeLocation(),
                req.officeHours(),
                req.websiteUrl(),
                req.email(),
                req.phone(),
                Boolean.TRUE.equals(req.showPhoneToStudents())
        );
        lecturerRepository.save(lecturer);
        if (audit != null) audit.record("LECTURER_PROFILE_UPDATED", lecturer.getLecturerCode(), "Cập nhật hồ sơ công khai giảng viên");
        return LecturerPublicProfileDto.forSelf(lecturer, lecturerTeachingSections(lecturer.getId()));
    }

    private List<LecturerPublicProfileDto.TeachingSectionDto> lecturerTeachingSections(Long lecturerId) {
        Semester semester;
        try {
            semester = currentSemester();
        } catch (IllegalStateException ex) {
            return List.of();
        }
        var counts = enrollmentRepository.activeCountsBySection().stream()
                .collect(java.util.stream.Collectors.toMap(r -> (String) r[0], r -> ((Number) r[1]).longValue()));
        return sectionRepository.findAllBySemester_CodeOrderBySectionCode(semester.getCode()).stream()
                .filter(s -> s.getLecturer() != null && s.getLecturer().getId().equals(lecturerId))
                .map(s -> LecturerPublicProfileDto.TeachingSectionDto.from(
                        s, s.totalEnrolled(counts.getOrDefault(s.getId(), 0L))))
                .toList();
    }

    private static void validateMaxLen(String value, int max, String fieldLabel) {
        if (value != null && value.trim().length() > max) {
            throw new IllegalArgumentException(fieldLabel + " tối đa " + max + " ký tự.");
        }
    }

    @Transactional(readOnly = true)
    public TrainingDashboardDto trainingDashboard() {
        Semester semester = currentSemester();
        var counts=enrollmentRepository.activeCountsBySection().stream().collect(java.util.stream.Collectors.toMap(r->(String)r[0],r->((Number)r[1]).longValue()));
        List<TrainingSectionDto> sections = sectionRepository.findAllBySemester_CodeOrderBySectionCode(semester.getCode()).stream()
                .map(section -> new TrainingSectionDto(section.getId(), section.getSectionCode(), section.getCourse().getCode(),
                        section.getCourse().getName(), section.getLecturerName(), section.getSchedule(), section.getRoom(),
                        section.totalEnrolled(counts.getOrDefault(section.getId(),0L)),
                        section.getCapacity(), section.getCourse().getPrerequisite()))
                .toList();
        long active = enrollmentRepository.countByStatus(Enrollment.Status.ENROLLED);
        long waiting = waitlistRepository.countByStatus(WaitlistEntry.Status.WAITING);
        long pending = enrollmentRepository.countByStatus(Enrollment.Status.PENDING);
        return new TrainingDashboardDto("Ban Đào tạo", semester.getName(), semester.getRegistrationOpenAt(),
                semester.getRegistrationCloseAt(), studentRepository.count(), courseRepository.count(), sections.size(),
                active, waiting, pending, sections);
    }

    @Transactional(readOnly = true)
    public AdminDashboardDto adminDashboard() {
        return new AdminDashboardDto("Admin", accounts.countByRole(com.courseregistration.entity.UserAccount.Role.STUDENT), accounts.countByRole(com.courseregistration.entity.UserAccount.Role.LECTURER), courseRepository.count(),
                sectionRepository.count(), enrollmentRepository.countByStatus(Enrollment.Status.ENROLLED),
                "Số liệu được tổng hợp trực tiếp từ cơ sở dữ liệu hiện tại.");
    }

    private Semester currentSemester() {
        var manual=semesterRepository.findFirstByRegistrationAlwaysOpenTrueAndStatusOrderByCodeDesc(Semester.Status.ACTIVE);
        if(manual.isPresent())return manual.get();
        var now=java.time.LocalDateTime.now();
        var activePeriod=registrationPeriods.findFirstByStartsAtLessThanEqualAndEndsAtGreaterThanEqualAndStatusIn(now,now,java.util.List.of(RegistrationPeriod.Status.SCHEDULED,RegistrationPeriod.Status.OPEN));
        if(activePeriod.isPresent())return activePeriod.get().getSemester();
        var activeSemester=semesterRepository.findFirstByStatusOrderByStartsAtDesc(Semester.Status.ACTIVE);
        if(activeSemester.isPresent())return activeSemester.get();
        var today = java.time.LocalDate.now();
        return semesterRepository.findFirstByRegistrationOpenAtLessThanEqualAndRegistrationCloseAtGreaterThanEqual(today, today)
                .or(() -> semesterRepository.findAllByOrderByStartsAtDesc().stream().findFirst())
                .orElseThrow(() -> new IllegalStateException("Chưa có học kỳ nào được khai báo."));
    }

    private LecturerSectionDto lecturerSection(CourseSection section) {
        int enrolled = section.totalEnrolled(enrollmentRepository.countBySection_IdAndStatus(section.getId(), Enrollment.Status.ENROLLED));
        return new LecturerSectionDto(section.getId(), section.getSectionCode(), section.getCourse().getCode(),
                section.getCourse().getName(), section.getSchedule(), section.getRoom(), enrolled, section.getCapacity(),section.getEffectiveMeetings().stream().map(MeetingDto::from).toList());
    }
}
