package com.courseregistration;

import com.courseregistration.entity.*;
import com.courseregistration.repository.*;
import com.courseregistration.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EnrollmentMeetingsTest {
    EnrollmentRepository enrollments=mock(EnrollmentRepository.class);
    WaitlistRepository waits=mock(WaitlistRepository.class);
    CourseService courses=mock(CourseService.class);
    AuthService auth=mock(AuthService.class);
    Semester semester=new Semester("20261","Học kỳ 20261",null,null,null);
    Student student=new Student("SV1","Sinh viên","CNTT","sv@example.test");
    EnrollmentService service=new EnrollmentService(enrollments,waits,courses,auth,mock(RegistrationPeriodRepository.class),mock(AuditService.class),20,7);
    @BeforeEach void setup(){when(auth.currentStudent()).thenReturn(student);when(courses.registrationOpen(semester)).thenReturn(true);semester.setRegistrationAlwaysOpen(true);}
    SectionMeeting meeting(int day,String weeks){return new SectionMeeting(day,LocalTime.of(9,0),LocalTime.of(11,0),"D9",weeks);}
    CourseSection section(String id,List<SectionMeeting> meetings){
        var s=new CourseSection(id,id,new Course(id,"Môn "+id,"CNTT",3,""),null,semester,"","",20,"lavender");s.replaceMeetings(meetings);return s;
    }
    void prepare(CourseSection requested,CourseSection previous){
        when(courses.findSectionForUpdate(requested.getId())).thenReturn(requested);
        when(enrollments.findAllByStudentAndSection_Semester_CodeAndStatusOrderByEnrolledAtAsc(student,"20261",Enrollment.Status.ENROLLED))
                .thenReturn(previous==null?List.of():List.of(new Enrollment(student,previous)));
        when(enrollments.findByStudentAndSection(student,requested)).thenReturn(Optional.empty());
    }
    @Test void detectsAConflictInTheSecondMeeting(){
        var requested=section("NEW",List.of(meeting(1,"2-9"),meeting(3,"2-9")));
        prepare(requested,section("OLD",List.of(meeting(3,"8-18"))));
        assertTrue(assertThrows(IllegalStateException.class,()->service.enroll("NEW")).getMessage().contains("trùng"));
        verify(enrollments,never()).save(any());
    }
    @Test void allowsSameDayAndTimeWhenWeeksDoNotOverlap(){
        var requested=section("NEW",List.of(meeting(1,"2,4,6")));
        prepare(requested,section("OLD",List.of(meeting(1,"3,5,7"))));
        assertTrue(service.enroll("NEW").contains("thành công"));verify(enrollments).save(any(Enrollment.class));
    }
    @Test void includesTheSchoolSnapshotWhenDecidingWhetherAClassIsFull(){
        var requested=section("NEW",List.of(meeting(1,"2-9")));requested.setImportedEnrolled(20);prepare(requested,null);
        assertTrue(service.enroll("NEW").contains("danh sách chờ"));
        verify(waits).save(any(WaitlistEntry.class));verify(enrollments,never()).save(any());
    }
    @Test void closedRegistrationStillBlocksAnOtherwiseValidClass(){
        var requested=section("NEW",List.of(meeting(1,"2-9")));prepare(requested,null);when(courses.registrationOpen(semester)).thenReturn(false);
        assertThrows(IllegalStateException.class,()->service.enroll("NEW"));verify(enrollments,never()).save(any());
    }
    @Test void manualOpenWithoutAStartDateAllowsCancellation(){
        var requested=section("NEW",List.of(meeting(1,"2-9")));when(courses.findSectionForUpdate("NEW")).thenReturn(requested);
        var enrollment=new Enrollment(student,requested);when(enrollments.findByStudentAndSectionAndStatus(student,requested,Enrollment.Status.ENROLLED)).thenReturn(Optional.of(enrollment));
        service.drop("NEW");assertEquals(Enrollment.Status.CANCELLED,enrollment.getStatus());
    }
    @Test void promotionRechecksTheSecondMeetingInsteadOfBypassingConflicts(){
        var requested=section("NEW",List.of(meeting(1,"2"),meeting(3,"4")));
        when(courses.findSectionForUpdate("NEW")).thenReturn(requested);
        when(enrollments.findByStudentAndSectionAndStatus(student,requested,Enrollment.Status.ENROLLED)).thenReturn(Optional.of(new Enrollment(student,requested)));
        var waitingStudent=new Student("SV2","Sinh viên chờ","CNTT","sv2@example.test");
        var waiting=new WaitlistEntry(waitingStudent,requested);
        when(waits.findAllBySectionAndStatusOrderByCreatedAtAscIdAsc(requested,WaitlistEntry.Status.WAITING)).thenReturn(List.of(waiting));
        when(enrollments.findAllByStudentAndSection_Semester_CodeAndStatusOrderByEnrolledAtAsc(waitingStudent,"20261",Enrollment.Status.ENROLLED))
                .thenReturn(List.of(new Enrollment(waitingStudent,section("CONFLICT",List.of(meeting(3,"4"))))));
        service.drop("NEW");assertEquals(WaitlistEntry.Status.WAITING,waiting.getStatus());verify(enrollments,never()).save(any());
    }
}
