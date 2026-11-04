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

    public WorkspaceService(LecturerRepository lecturerRepository, StudentRepository studentRepository,
                              CourseRepository courseRepository, CourseSectionRepository sectionRepository,
                              EnrollmentRepository enrollmentRepository, SemesterRepository semesterRepository,
                              WaitlistRepository waitlistRepository, AuthService authService,
                              RegistrationPeriodRepository registrationPeriods,UserAccountRepository accounts) {
        this.lecturerRepository = lecturerRepository; this.studentRepository = studentRepository;
        this.courseRepository = courseRepository; this.sectionRepository = sectionRepository;
        this.enrollmentRepository = enrollmentRepository; this.semesterRepository = semesterRepository;
        this.waitlistRepository = waitlistRepository;
        this.authService = authService;
        this.registrationPeriods=registrationPeriods;this.accounts=accounts;
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
