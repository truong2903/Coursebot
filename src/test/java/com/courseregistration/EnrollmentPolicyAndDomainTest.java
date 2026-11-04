package com.courseregistration;

import com.courseregistration.entity.*;
import com.courseregistration.repository.*;
import com.courseregistration.service.AuthService;
import com.courseregistration.service.CourseService;
import com.courseregistration.service.EnrollmentService;
import com.courseregistration.service.policy.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:oop-policy-tests;DB_CLOSE_DELAY=-1",
        "app.academic.source-url=",
        "app.timetable.source-url=",
        "app.preview.accounts-enabled=false",
        "app.ai.api-key="
})
@Transactional
class EnrollmentPolicyAndDomainTest {

    @Autowired DepartmentRepository departments;
    @Autowired AcademicProgramRepository programs;
    @Autowired AdministrativeClassRepository administrativeClasses;
    @Autowired TeachingPeriodRepository teachingPeriods;
    @Autowired AcademicResultRepository academicResults;
    @Autowired CourseConditionRepository courseConditions;
    @Autowired StudentRepository students;
    @Autowired CourseRepository courses;
    @Autowired SemesterRepository semesters;
    @Autowired CourseSectionRepository sections;
    @Autowired EnrollmentRepository enrollments;
    @Autowired WaitlistRepository waitlists;
    @Autowired CourseService courseService;
    @Autowired EnrollmentService enrollmentService;
    @MockitoBean AuthService auth;

    @Test
    void enrichedAcademicEntitiesAndRepositoriesPersistAndEvaluateDomainLogic() {
        var dept = departments.saveAndFlush(new Department("FIT", "Khoa Công nghệ thông tin"));
        dept.rename("Khoa CNTT & Truyền thông");
        assertEquals("Khoa CNTT & Truyền thông", departments.findById("FIT").orElseThrow().getName());

        var program = programs.saveAndFlush(new AcademicProgram("CNTT", "Công nghệ thông tin", dept));
        var adminClass = administrativeClasses.saveAndFlush(new AdministrativeClass("IT24A", program, "K2024"));
        assertEquals("CNTT", administrativeClasses.findAll().getFirst().getProgram().getCode());
        assertEquals("K2024", adminClass.getCohort());

        var period = teachingPeriods.saveAndFlush(
                new TeachingPeriod(1, LocalTime.of(7, 0), LocalTime.of(7, 50), "Sáng", "Chính thức"));
        assertEquals(LocalTime.of(7, 0), teachingPeriods.findAllByOrderByCodeAsc().getFirst().getStartsAt());
        assertNotNull(period.getCode());
        assertThrows(IllegalArgumentException.class,
                () -> new TeachingPeriod(2, LocalTime.of(9, 0), LocalTime.of(8, 0), "Sáng", "Chính thức"));

        var pastTerm = semesters.saveAndFlush(new Semester("20251", "Học kỳ 1 2025", LocalDate.of(2025, 9, 1), null, null));
        var currentTerm = new Semester("20252", "Học kỳ 2 2025", LocalDate.of(2026, 2, 2), null, null);
        currentTerm.setWeekCalendar("2025-2026", 2, LocalDate.of(2026, 2, 2), 15);
        currentTerm = semesters.saveAndFlush(currentTerm);
        assertEquals(1, currentTerm.teachingWeekOf(LocalDate.of(2026, 2, 4)).orElse(-1));
        assertEquals(15, currentTerm.teachingWeekOf(LocalDate.of(2026, 5, 11)).orElse(-1));
        assertTrue(currentTerm.teachingWeekOf(LocalDate.of(2026, 6, 1)).isEmpty());

        var c1 = courses.saveAndFlush(new Course("INF101", "Nhập môn lập trình", "FIT", 3, "Không có"));
        var c2 = courses.saveAndFlush(new Course("INF102", "Cấu trúc dữ liệu", "FIT", 3, "INF101"));
        var c3 = courses.saveAndFlush(new Course("INF103", "Thực hành CTDL", "FIT", 2, "Không có"));

        assertThrows(IllegalArgumentException.class,
                () -> new CourseCondition(c1, c1, CourseCondition.TYPE_PREREQUISITE));

        courseConditions.saveAllAndFlush(List.of(
                new CourseCondition(c2, c1, CourseCondition.TYPE_PRIOR_STUDY),
                new CourseCondition(c2, c3, CourseCondition.TYPE_COREQUISITE)
        ));

        var ruleViews = courseConditions.findAllRuleViews();
        assertEquals(2, ruleViews.size());
        assertTrue(CourseCondition.evaluate(CourseCondition.TYPE_PRIOR_STUDY, "INF101", Set.of(), Set.of("INF101"), Set.of()));
        assertFalse(CourseCondition.evaluate(CourseCondition.TYPE_COREQUISITE, "INF103", Set.of(), Set.of("INF101"), Set.of()));
        assertTrue(CourseCondition.evaluate(CourseCondition.TYPE_COREQUISITE, "INF103", Set.of(), Set.of("INF101"), Set.of("INF103")));

        var student = students.saveAndFlush(new Student("24IT999", "Nguyễn Văn A", "CNTT", "nva@example.test", Set.of()));
        var result = academicResults.saveAndFlush(
                new AcademicResult(student, c1, pastTerm, AcademicResult.OUTCOME_FAILED, new BigDecimal("4.00"), "F"));
        assertTrue(result.isFailed());
        assertFalse(result.isPassed());
        assertTrue(result.studiedBefore(currentTerm));
        assertTrue(result.formatTranscriptLine().contains("INF101"));
        assertEquals(1, academicResults.findTranscriptByStudentId(student.getId()).size());
    }

    @Test
    void springInjectsOrderedEnrollmentStrategyChain() {
        var ruleTypes = enrollmentService.rules().stream().map(r -> r.getClass().getSimpleName()).toList();
        assertEquals(List.of(
                "SectionAvailabilityRule",
                "DuplicateEnrollmentRule",
                "CreditLimitRule",
                "PrerequisiteRule",
                "CourseConditionRule",
                "ScheduleConflictRule"
        ), ruleTypes);

        var semester = new Semester("20261", "HK1", LocalDate.now(), null, null);
        var student = new Student("24IT888", "Trần Thị B", "CNTT", "ttb@example.test", Set.of());
        var prereqCourse = new Course("DSA201", "Cấu trúc dữ liệu", "CNTT", 4, "INF101");
        prereqCourse.setPrerequisiteCodes(Set.of("INF101"));
        var targetSection = new CourseSection("SEC-1", "SEC-1", prereqCourse, null, semester, "Thứ 2", "A101", 40, "lavender");

        var context = new EnrollmentValidationContext(student, targetSection, List.of(), false, true);
        assertTrue(new PrerequisiteRule().checkViolation(context).orElse("").contains("môn tiên quyết"));
        assertTrue(new CreditLimitRule(3).checkViolation(context).orElse("").contains("vượt quá giới hạn 3 tín chỉ"));
        assertTrue(new DuplicateEnrollmentRule().checkViolation(
                new EnrollmentValidationContext(student, targetSection, List.of(), true, true)).isPresent());
    }

    @Test
    void enrollmentEnforcesAllThreeCourseConditionTypesDropGuardAndWaitlistPromotion() {
        var pastTerm = new Semester("PAST-2025", "Học kỳ trước", LocalDate.now().minusMonths(6), null, null);
        pastTerm.update("Học kỳ trước", LocalDate.now().minusMonths(6), LocalDate.now().minusMonths(2), null, null, Semester.Status.COMPLETED);
        pastTerm = semesters.saveAndFlush(pastTerm);

        var openTerm = new Semester("OPEN-2026", "Học kỳ mở đăng ký", LocalDate.now().plusDays(1), LocalDate.now().minusDays(2), LocalDate.now().plusDays(10));
        openTerm.update("Học kỳ mở đăng ký", LocalDate.now().plusDays(1), LocalDate.now().plusMonths(4), LocalDate.now().minusDays(2), LocalDate.now().plusDays(10), Semester.Status.ACTIVE);
        openTerm.setRegistrationAlwaysOpen(true);
        openTerm = semesters.saveAndFlush(openTerm);

        var prereq = courses.saveAndFlush(new Course("PREREQ101", "Môn tiên quyết", "CNTT", 3, "Không có"));
        var prior = courses.saveAndFlush(new Course("PRIOR101", "Môn học trước", "CNTT", 3, "Không có"));
        var coreq = courses.saveAndFlush(new Course("COREQ201", "Môn song hành", "CNTT", 2, "Không có"));
        var target = courses.saveAndFlush(new Course("ADV301", "Môn nâng cao tổng hợp", "CNTT", 3,
                "Tiên quyết: PREREQ101; Học trước: PRIOR101; Song hành: COREQ201"));

        courseConditions.saveAllAndFlush(List.of(
                new CourseCondition(target, prereq, CourseCondition.TYPE_PREREQUISITE),
                new CourseCondition(target, prior, CourseCondition.TYPE_PRIOR_STUDY),
                new CourseCondition(target, coreq, CourseCondition.TYPE_COREQUISITE)
        ));

        var coreqSection = new CourseSection("SEC-COREQ", "SEC-COREQ", coreq, null, openTerm, "Thứ 2 (07:00-08:50)", "A101", 30, "mint");
        coreqSection.replaceMeetings(List.of(new SectionMeeting(1, LocalTime.of(7, 0), LocalTime.of(8, 50), "A101", "1-15")));
        coreqSection = sections.saveAndFlush(coreqSection);

        var targetSection = new CourseSection("SEC-ADV", "SEC-ADV", target, null, openTerm, "Thứ 4 (09:00-10:50)", "B202", 1, "lavender");
        targetSection.replaceMeetings(List.of(new SectionMeeting(3, LocalTime.of(9, 0), LocalTime.of(10, 50), "B202", "1-15")));
        targetSection = sections.saveAndFlush(targetSection);

        var student = students.saveAndFlush(new Student("24IT777", "Lê Văn C", "CNTT", "lvc@example.test", Set.of("PREREQ101")));
        when(auth.currentStudent()).thenReturn(student);

        // 1. Chặn khi chưa học môn Học trước và chưa đăng ký môn Song hành
        var ex1 = assertThrows(IllegalStateException.class, () -> enrollmentService.enroll("SEC-ADV"));
        assertTrue(ex1.getMessage().contains("học trước: PRIOR101"), ex1.getMessage());
        assertTrue(ex1.getMessage().contains("song hành: COREQ201"), ex1.getMessage());

        // 2. Đã học PRIOR101 ở kỳ trước (dù kết quả Chưa đạt) -> thỏa Học trước, chỉ còn thiếu Song hành
        academicResults.saveAndFlush(new AcademicResult(
                student, prior, pastTerm, AcademicResult.OUTCOME_FAILED, new BigDecimal("3.50"), "F"));
        var openDtosBefore = courseService.listOpenSections();
        var advDtoBefore = openDtosBefore.stream().filter(d -> d.id().equals("SEC-ADV")).findFirst().orElseThrow();
        assertFalse(advDtoBefore.prerequisiteMet());
        assertEquals("Thiếu song hành", advDtoBefore.conditionBlockReason());

        var ex2 = assertThrows(IllegalStateException.class, () -> enrollmentService.enroll("SEC-ADV"));
        assertFalse(ex2.getMessage().contains("PRIOR101"), ex2.getMessage());
        assertTrue(ex2.getMessage().contains("song hành: COREQ201"), ex2.getMessage());

        // 3. Đăng ký môn Song hành COREQ201 trong cùng kỳ -> mở khóa đăng ký ADV301
        assertTrue(enrollmentService.enroll("SEC-COREQ").contains("thành công"));
        var advDtoAfter = courseService.listOpenSections().stream().filter(d -> d.id().equals("SEC-ADV")).findFirst().orElseThrow();
        assertTrue(advDtoAfter.prerequisiteMet());
        assertNull(advDtoAfter.conditionBlockReason());

        assertTrue(enrollmentService.enroll("SEC-ADV").contains("thành công"));

        // 4. Chặn lách luật hủy môn Song hành COREQ201 khi vẫn đang giữ ADV301
        var dropEx = assertThrows(IllegalStateException.class, () -> enrollmentService.drop("SEC-COREQ"));
        assertTrue(dropEx.getMessage().contains("ADV301"), dropEx.getMessage());
        assertTrue(dropEx.getMessage().contains("song hành"), dropEx.getMessage());

        // 5. Xét duyệt danh sách chờ cũng kiểm tra đủ 3 điều kiện (bỏ qua người thiếu Học trước, duyệt người đủ cả 3)
        var ineligibleWaiter = students.saveAndFlush(new Student("24IT778", "Phạm D", "CNTT", "pd@example.test", Set.of("PREREQ101", "COREQ201")));
        var eligibleWaiter = students.saveAndFlush(new Student("24IT779", "Hoàng E", "CNTT", "he@example.test", Set.of("PREREQ101", "COREQ201")));
        academicResults.saveAndFlush(new AcademicResult(
                eligibleWaiter, prior, pastTerm, AcademicResult.OUTCOME_FAILED, new BigDecimal("4.00"), "F"));

        var w1 = waitlists.saveAndFlush(new WaitlistEntry(ineligibleWaiter, targetSection));
        var w2 = waitlists.saveAndFlush(new WaitlistEntry(eligibleWaiter, targetSection));

        String dropTargetMsg = enrollmentService.drop("SEC-ADV");
        assertTrue(dropTargetMsg.contains("danh sách chờ đã được thêm vào lớp"), dropTargetMsg);
        assertEquals(WaitlistEntry.Status.WAITING, w1.getStatus());
        assertEquals(WaitlistEntry.Status.PROMOTED, w2.getStatus());

        // Sau khi đã hủy ADV301, sinh viên ban đầu được phép hủy COREQ201 bình thường
        assertTrue(enrollmentService.drop("SEC-COREQ").contains("Đã hủy học phần COREQ201"));
    }
}
