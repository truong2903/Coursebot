package com.courseregistration;

import com.courseregistration.dto.*;
import com.courseregistration.entity.*;
import com.courseregistration.repository.*;
import com.courseregistration.service.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:chat-tests;DB_CLOSE_DELAY=-1","app.academic.source-url=","app.timetable.source-url=","app.preview.accounts-enabled=false","app.ai.api-key="})
@Transactional
class AcademicChatIntegrationTest {
    @Autowired AcademicChatService chat;
    @Autowired StudentRepository students;
    @Autowired CourseRepository courses;
    @Autowired SemesterRepository semesters;
    @Autowired CourseSectionRepository sections;
    @Autowired EnrollmentRepository registrations;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean AuthService auth;
    Student student; Semester term; Course basic;
    @BeforeEach void fixture() {
        term=new Semester("CURRENT","Kỳ đang học",LocalDate.now().minusDays(40),LocalDate.now().minusDays(70),LocalDate.now().minusDays(45));
        term.update("Kỳ đang học",LocalDate.now().minusDays(40),LocalDate.now().plusDays(60),LocalDate.now().minusDays(70),LocalDate.now().minusDays(45),Semester.Status.ACTIVE);
        term=semesters.saveAndFlush(term);
        student=students.saveAndFlush(new Student("24IT001","Sinh viên thử","CNTT","student@example.test",Set.of("INF101")));
        student.updateProfile(student.getFullName(),"CNTT","K2024",student.getEmail());
        when(auth.currentStudent()).thenReturn(student);
        basic=course("INF101","Nhập môn lập trình",3,"Không có môn tiên quyết");
        var enrolled=section("BASE",basic,List.of(meeting(1,"1-10"),meeting(3,"1-5")));
        registrations.saveAndFlush(new Enrollment(student,enrolled));
    }
    Course course(String code,String name,int credits,String prerequisite) {return courses.saveAndFlush(new Course(code,name,"CNTT",credits,prerequisite));}
    SectionMeeting meeting(int day,String weeks){return new SectionMeeting(day,LocalTime.of(9,0),LocalTime.of(11,0),"R1",weeks);}
    CourseSection section(String id,Course course,List<SectionMeeting> meetings){var s=new CourseSection(id,id,course,null,term,"Nhiều buổi","R1",40,"lavender");s.replaceMeetings(meetings);return sections.saveAndFlush(s);}
    String ask(String message){return chat.answer(new ChatRequest(message,List.of())).reply();}
    void program(Course... entries){
        jdbc.update("INSERT INTO curricula(code,name,program,cohort,version,status) VALUES('CT','CT CNTT','CNTT','K2024','1','ACTIVE')");
        Long id=jdbc.queryForObject("SELECT id FROM curricula WHERE code='CT'",Long.class);int i=0;
        for(var c:entries)jdbc.update("INSERT INTO curriculum_courses(curriculum_id,course_id,suggested_semester,required_course,order_index) VALUES(?,?,?,TRUE,?)",id,c.getId(),"1",i++);
    }
    @Test void accentedRegisteredQuestionUsesActualCreditsAndLabelsTrialPolicy(){String answer=ask("Tôi đã đăng ký bao nhiêu tín chỉ?");assertTrue(answer.contains("3/20"));assertTrue(answer.contains("thử nghiệm"));}
    @Test void courseCreditQuestionDoesNotReturnAggregateAndFollowupResolvesUserHistory(){
        var c=course("INF202","Cơ sở dữ liệu",4,"Không có môn tiên quyết");
        assertTrue(ask("INF202 có bao nhiêu tín chỉ?").contains("4 tín chỉ"));
        var reply=chat.answer(new ChatRequest("Còn điều kiện của môn đó?",List.of(new ChatHistoryMessage("user","Cho tôi biết INF202")))).reply();
        assertTrue(reply.contains(c.getName()));
    }
    @Test void recommendationsCheckSecondMeetingDisjointWeeksAndMutualSchedule(){
        var b=course("BAD201","Môn trùng buổi thứ hai",3,"Không có môn tiên quyết");
        var c=course("OK201","Môn học tuần khác",3,"Không có môn tiên quyết");
        var d=course("BAD202","Môn trùng gợi ý",3,"Không có môn tiên quyết");
        var e=course("BIG201","Môn vượt tín chỉ",18,"Không có môn tiên quyết");
        var u=course("UNKNOWN201","Môn chưa có điều kiện",3,"Chưa có dữ liệu tiên quyết");
        section("B",b,List.of(meeting(2,"1-5"),meeting(3,"1-5")));
        section("C",c,List.of(meeting(3,"6-10")));
        section("D",d,List.of(meeting(3,"6-10")));
        section("E",e,List.of(meeting(5,"1-10")));
        section("U",u,List.of(meeting(6,"1-10")));
        program(b,c,d,e,u);
        String reply=ask("Gợi ý môn học phù hợp");
        assertTrue(reply.contains("OK201"));assertTrue(reply.contains("6/20"));assertTrue(reply.contains("đang đóng"));
        for(String code:List.of("BAD201","BAD202","BIG201","UNKNOWN201"))assertFalse(reply.contains(code),reply);
    }
    @Test void pendingAndFullClassesAreExcludedFromRecommendations(){
        var p=course("PEND201","Môn chờ xác nhận",3,"Không có môn tiên quyết");var full=course("FULL201","Môn đủ chỗ",3,"Không có môn tiên quyết");
        var pending=section("PENDING",p,List.of(meeting(5,"1-10")));var fullSection=section("FULL",full,List.of(meeting(6,"1-10")));fullSection.setImportedEnrolled(40);sections.saveAndFlush(fullSection);
        jdbc.update("INSERT INTO enrollments(student_id,section_id,enrolled_at,status,enrollment_date_only) VALUES(?,?,CURRENT_TIMESTAMP,'PENDING',FALSE)",student.getId(),pending.getId());
        program(p,full);String answer=ask("Gợi ý môn học phù hợp");assertTrue(answer.contains("Chưa tìm được lớp"));
    }
    @Test void priorStudyDoesNotRequirePassingAndCorequisiteNeedsConcurrentCourse(){
        var failed=course("FAIL101","Môn đã học chưa đạt",3,"Không có môn tiên quyết");
        var target=course("NEXT201","Môn yêu cầu học trước",3,"Không có môn tiên quyết");
        jdbc.update("INSERT INTO semesters(code,name,starts_at,status,registration_always_open) VALUES('PAST','Kỳ cũ',?,'COMPLETED',FALSE)",LocalDate.now().minusYears(1));
        var old=jdbc.queryForObject("SELECT id FROM semesters WHERE code='PAST'",Long.class);
        jdbc.update("INSERT INTO academic_results(student_id,course_id,semester_id,outcome,grade) VALUES(?,?,?,'Chưa đạt',3)",student.getId(),failed.getId(),old);
        jdbc.update("INSERT INTO course_conditions(course_id,condition_course_id,condition_type) VALUES(?,?,'Học trước'),(?,?,'Song hành')",target.getId(),failed.getId(),target.getId(),basic.getId());
        assertTrue(ask("Điều kiện NEXT201").contains("Bạn đáp ứng"));
        jdbc.update("UPDATE course_conditions SET condition_course_id=? WHERE condition_type='Song hành'",failed.getId());
        assertTrue(ask("Điều kiện NEXT201").contains("Chưa đáp ứng: Song hành FAIL101"));
    }
    @Test void transcriptPreservesRetakeAndDoesNotInventGpa(){
        jdbc.update("INSERT INTO semesters(code,name,status,registration_always_open) VALUES('OLD','Kỳ cũ','COMPLETED',FALSE)");
        Long old=jdbc.queryForObject("SELECT id FROM semesters WHERE code='OLD'",Long.class);
        jdbc.update("INSERT INTO academic_results(student_id,course_id,semester_id,outcome,grade) VALUES(?,?,?,'Chưa đạt',3),(?,?,?,'Đạt',8)",student.getId(),basic.getId(),old,student.getId(),basic.getId(),term.getId());
        String answer=ask("Tôi có môn nào chưa đạt cần học lại?");assertTrue(answer.contains("đã có lần khác Đạt"));assertTrue(answer.contains("chưa tính GPA"));
    }
    @Test void curriculumUsesOwnProgramAndDoesNotCallElectivesMandatory(){var c=course("LEFT201","Môn còn thiếu",3,"Không có môn tiên quyết");program(basic,c);String answer=ask("Tôi còn thiếu môn nào?");assertTrue(answer.contains("LEFT201"));assertTrue(answer.contains("không có nghĩa tất cả đều bắt buộc"));}
    @Test void missingOfficialPolicyAndOtherStudentAreExplicit(){assertTrue(ask("Học phí trường bao nhiêu?").contains("chưa có tài liệu"));assertTrue(ask("Xem điểm sinh viên 24IT002").contains("không cung cấp"));}
    @Test void noArbitraryFiftyCourseLimit(){for(int i=0;i<55;i++)course("TEST"+i,"Môn kiểm tra "+i,2,"Không có môn tiên quyết");var last=course("ZZ999","Môn cuối danh mục",5,"Không có môn tiên quyết");assertTrue(ask("ZZ999 là môn gì?").contains(last.getName()));}
    @Test void unknownCurriculumAndDatesDoNotFabricateData(){assertTrue(ask("Khung chương trình của tôi").contains("Chưa có khung chương trình"));assertTrue(ask("Khi nào hết hạn đăng ký?").contains("đang đóng"));assertTrue(ask("Tôi muốn hủy môn").contains("đã quá hạn"));}
    @Test void timetableFiltersWeeksAndDoesNotInventCalendarWhenWeekOneIsMissing(){
        assertTrue(ask("Lịch học thứ 4 tuần 3").contains("BASE"));
        assertFalse(ask("Lịch học thứ 4 tuần 8").contains("BASE"));
        assertTrue(ask("Ngày mai tôi học gì?").contains("Chưa có ngày bắt đầu tuần 1"));
    }
}
