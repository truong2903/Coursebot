package com.courseregistration.controller;

import com.courseregistration.dto.CourseSectionDto;
import com.courseregistration.dto.DashboardDto;
import com.courseregistration.dto.StudentDto;
import com.courseregistration.service.AuthService;
import com.courseregistration.service.CourseService;
import com.courseregistration.service.EnrollmentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.List;

@RestController
@RequestMapping("/api")
public class CourseController {
    private final AuthService authService;
    private final CourseService courseService;
    private final EnrollmentService enrollmentService;

    public CourseController(AuthService authService, CourseService courseService, EnrollmentService enrollmentService) {
        this.authService = authService; this.courseService = courseService; this.enrollmentService = enrollmentService;
    }

    @GetMapping("/dashboard")
    @PreAuthorize("@accessPolicy.has(authentication, 'STUDENT_ACADEMIC')")
    public DashboardDto dashboard() {
        var student = authService.currentStudent();
        var semester = courseService.currentSemester();
        boolean registrationOpen = courseService.registrationOpen(semester);
        return new DashboardDto(StudentDto.from(student, semester.getName()), courseService.listOpenSections(),
                enrollmentService.registeredSections(), enrollmentService.currentCredits(), enrollmentService.maxCredits(),
                semester.getCode(), semester.getName(), semester.getRegistrationOpenAt(), semester.getRegistrationCloseAt(), registrationOpen,enrollmentService.dropWindowDays(),semester.isRegistrationAlwaysOpen(),semester.getStartsAt());
    }

    @GetMapping("/courses")
    @PreAuthorize("@accessPolicy.has(authentication, 'STUDENT_ACADEMIC')")
    public List<CourseSectionDto> listCourses() { return courseService.listOpenSections(); }

    @GetMapping("/courses/{sectionId}")
    @PreAuthorize("@accessPolicy.has(authentication, 'STUDENT_ACADEMIC')")
    public CourseSectionDto courseDetails(@org.springframework.web.bind.annotation.PathVariable String sectionId) {
        return courseService.getSection(sectionId);
    }
}
