package com.courseregistration;

import com.courseregistration.entity.*;
import com.courseregistration.repository.*;
import com.courseregistration.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
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
        "spring.datasource.url=jdbc:h2:mem:transcript-pending-tests;DB_CLOSE_DELAY=-1",
        "app.academic.source-url=",
        "app.timetable.source-url=",
        "app.preview.accounts-enabled=false",
        "app.ai.api-key="
})
@Transactional
class TranscriptAndPendingApprovalTest {

    @Autowired StudentRepository students;
    @Autowired CourseRepository courses;
    @Autowired SemesterRepository semesters;
    @Autowired CourseSectionRepository sections;
    @Autowired EnrollmentRepository enrollments;
    @Autowired WaitlistRepository waitlists;
    @Autowired AcademicResultRepository academicResults;
    @Autowired AuditLogRepository auditLogs;
    @Autowired StudentAcademicService studentAcademicService;
    @Autowired EnrollmentService enrollmentService;
    @Autowired TrainingManagementService trainingService;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean AuthService auth;

    @Test
    void studentTranscriptCalculatesUniqueCreditsRetakesAndWeightedAverage() {
        var term1 = semesters.saveAndFlush(new Semester("HK1", "Học kỳ 1", LocalDate.of(2025, 9, 1), null, null));
        var term2 = semesters.saveAndFlush(new Semester("HK2", "Học kỳ 2", LocalDate.of(2026, 2, 1), null, null));

        var math = courses.saveAndFlush(new Course("MAT101", "Giải tích 1", "TOAN", 3, "Không có"));
        var db = courses.saveAndFlush(new Course("INF202", "Cơ sở dữ liệu", "CNTT", 4, "Không có"));

        var student = students.saveAndFlush(new Student("24IT501", "Nguyễn Minh Khôi", "CNTT", "khoi@example.test", Set.of("MAT101", "INF202")));
        student.updateProfile("Nguyễn Minh Khôi", "CNTT", "K2024", "khoi@example.test");
        when(auth.currentStudent()).thenReturn(student);

        // MAT101 học lần 1 Chưa đạt (3.5), học lại lần 2 Đạt (8.0); INF202 Đạt (9.0)
        academicResults.saveAllAndFlush(List.of(
                new AcademicResult(student, math, term1, AcademicResult.OUTCOME_FAILED, new BigDecimal("3.50"), "F"),
                new AcademicResult(student, math, term2, AcademicResult.OUTCOME_PASSED, new BigDecimal("8.00"), "B+"),
                new AcademicResult(student, db, term2, AcademicResult.OUTCOME_PASSED, new BigDecimal("9.00"), "A")
        ));

        var transcript = studentAcademicService.transcript();
        assertEquals(3, transcript.totalRecords());
        assertEquals(2, transcript.completedCourseCount());
        assertEquals(7, transcript.accumulatedCredits()); // 3 + 4 (không cộng trùng lần học lại!)
        // Điểm TB hệ 10 theo điểm cao nhất mỗi môn: (8.0*3 + 9.0*4) / 7 = 60 / 7 = 8.57
        assertEquals(new BigDecimal("8.57"), transcript.weightedAverageGrade10());

        var failedAttempt = transcript.results().stream()
                .filter(r -> r.courseCode().equals("MAT101") && !r.passed())
                .findFirst().orElseThrow();
        assertTrue(failedAttempt.retakenAndPassed());
    }

    @Test
    void trainingOfficeApprovesRejectsPendingAndDropsOverdueEnrollmentsWithWaitlistPromotion() {
        // Học kỳ đã bắt đầu 30 ngày trước (quá hạn 7 ngày tự hủy của sinh viên) và đã đóng đăng ký
        var term = new Semester("ACTIVE-2026", "Học kỳ đang học",
                LocalDate.now().minusDays(30), LocalDate.now().minusDays(50), LocalDate.now().minusDays(35));
        term.update("Học kỳ đang học", LocalDate.now().minusDays(30), LocalDate.now().plusDays(60),
                LocalDate.now().minusDays(50), LocalDate.now().minusDays(35), Semester.Status.ACTIVE);
        term = semesters.saveAndFlush(term);

        var prereq = courses.saveAndFlush(new Course("INF101", "Nhập môn lập trình", "CNTT", 3, "Không có"));
        var oop = courses.saveAndFlush(new Course("INF201", "Lập trình hướng đối tượng", "CNTT", 3, "INF101", "INF101"));

        var section = new CourseSection("SEC-OOP-01", "OOP-01", oop, null, term, "Thứ 3 (07:00-08:50)", "C301", 1, "lavender");
        section.replaceMeetings(List.of(new SectionMeeting(2, LocalTime.of(7, 0), LocalTime.of(8, 50), "C301", "1-15")));
        section = sections.saveAndFlush(section);

        var eligibleStudent = students.saveAndFlush(new Student("24IT601", "Trần Quốc Bảo", "CNTT", "bao@example.test", Set.of("INF101")));
        var missingPrereqStudent = students.saveAndFlush(new Student("24IT602", "Lê Thu Hà", "CNTT", "ha@example.test", Set.of()));
        var waitingStudent = students.saveAndFlush(new Student("24IT603", "Phạm Gia Huy", "CNTT", "huy@example.test", Set.of("INF101")));

        jdbc.update("INSERT INTO enrollments(student_id, section_id, enrolled_at, status, enrollment_date_only) VALUES(?, ?, CURRENT_TIMESTAMP, 'PENDING', TRUE)",
                eligibleStudent.getId(), section.getId());
        jdbc.update("INSERT INTO enrollments(student_id, section_id, enrolled_at, status, enrollment_date_only) VALUES(?, ?, CURRENT_TIMESTAMP, 'PENDING', TRUE)",
                missingPrereqStudent.getId(), section.getId());

        var pendingList = trainingService.listEnrollments("ACTIVE-2026", Enrollment.Status.PENDING, null);
        assertEquals(2, pendingList.size());
        Long eligiblePendingId = pendingList.stream().filter(d -> d.studentCode().equals("24IT601")).findFirst().orElseThrow().id();
        Long ineligiblePendingId = pendingList.stream().filter(d -> d.studentCode().equals("24IT602")).findFirst().orElseThrow().id();

        // 1. Duyệt SV thiếu tiên quyết -> bị chặn bởi PrerequisiteRule trong chuỗi Strategy!
        assertThrows(IllegalStateException.class, () -> trainingService.approvePendingEnrollment(ineligiblePendingId));

        // 2. Từ chối bản ghi PENDING không đủ điều kiện
        String rejectMsg = trainingService.rejectPendingEnrollment(ineligiblePendingId, "Chưa hoàn thành INF101");
        assertTrue(rejectMsg.contains("24IT602"));
        assertEquals(Enrollment.Status.CANCELLED, enrollments.findById(ineligiblePendingId).orElseThrow().getStatus());

        // 3. Duyệt bản ghi PENDING hợp lệ -> chuyển sang ENROLLED dù đợt đăng ký của SV đã đóng
        String approveMsg = trainingService.approvePendingEnrollment(eligiblePendingId);
        assertTrue(approveMsg.contains("24IT601"));
        assertEquals(Enrollment.Status.ENROLLED, enrollments.findById(eligiblePendingId).orElseThrow().getStatus());

        // 4. Sinh viên tự hủy khi đã quá 7 ngày đầu học kỳ -> bị từ chối
        when(auth.currentStudent()).thenReturn(eligibleStudent);
        var selfDropEx = assertThrows(IllegalStateException.class, () -> enrollmentService.drop("SEC-OOP-01"));
        assertTrue(selfDropEx.getMessage().contains("Đã quá 7 ngày"));

        // 5. Ban Đào tạo hủy môn hộ sinh viên quá hạn -> thành công và tự động đôn SV danh sách chờ đủ điều kiện lên lớp!
        var waitEntry = waitlists.saveAndFlush(new WaitlistEntry(waitingStudent, section));
        var adminView = trainingService.listEnrollments("ACTIVE-2026", Enrollment.Status.ENROLLED, "24IT601").getFirst();
        assertTrue(adminView.pastStudentDropWindow());

        String adminDropMsg = trainingService.adminDropEnrollment(eligiblePendingId, "Đơn xin rút học phần có xác nhận khoa");
        assertTrue(adminDropMsg.contains("24IT601"), adminDropMsg);
        assertTrue(adminDropMsg.contains("24IT603"), adminDropMsg);
        assertEquals(Enrollment.Status.CANCELLED, enrollments.findById(eligiblePendingId).orElseThrow().getStatus());
        assertEquals(WaitlistEntry.Status.PROMOTED, waitlists.findById(waitEntry.getId()).orElseThrow().getStatus());
        assertTrue(auditLogs.findAll().stream().anyMatch(log -> "ENROLLMENT_ADMIN_DROPPED".equals(log.getAction())));
    }
}
