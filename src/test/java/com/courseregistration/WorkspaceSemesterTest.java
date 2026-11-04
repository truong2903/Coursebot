package com.courseregistration;

import com.courseregistration.entity.*;
import com.courseregistration.repository.*;
import com.courseregistration.service.*;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WorkspaceSemesterTest {
    @Test void lecturerDefaultsToActiveTermAfterRegistrationClosesEvenWhenFutureTermExists() {
        var semesters=mock(SemesterRepository.class);
        var periods=mock(RegistrationPeriodRepository.class);
        var sections=mock(CourseSectionRepository.class);
        var auth=mock(AuthService.class);
        var active=new Semester("CURRENT","Kỳ đang học",LocalDate.now().minusMonths(1),LocalDate.now().minusMonths(2),LocalDate.now().minusMonths(1));
        var future=new Semester("FUTURE","Kỳ sắp tới",LocalDate.now().plusMonths(3),LocalDate.now().plusMonths(2),LocalDate.now().plusMonths(3));
        when(semesters.findFirstByStatusOrderByStartsAtDesc(Semester.Status.ACTIVE)).thenReturn(Optional.of(active));
        when(semesters.findAllByOrderByStartsAtDesc()).thenReturn(List.of(future,active));
        when(auth.currentLecturer()).thenReturn(new Lecturer("GV01","Giảng viên","CNTT"));
        when(sections.findAllBySemester_CodeOrderBySectionCode("CURRENT")).thenReturn(List.of());
        var workspace=new WorkspaceService(mock(LecturerRepository.class),mock(StudentRepository.class),mock(CourseRepository.class),sections,mock(EnrollmentRepository.class),semesters,mock(WaitlistRepository.class),auth,periods,mock(UserAccountRepository.class));
        assertEquals("CURRENT",workspace.lecturerDashboard(null).semesterCode());
        verify(sections).findAllBySemester_CodeOrderBySectionCode("CURRENT");
        verify(semesters,never()).findAllByOrderByStartsAtDesc();
    }
}
