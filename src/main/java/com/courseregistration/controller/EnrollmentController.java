package com.courseregistration.controller;

import com.courseregistration.dto.ActionResponse;
import com.courseregistration.dto.EnrollmentRequest;
import com.courseregistration.dto.EnrollmentHistoryDto;
import com.courseregistration.service.EnrollmentService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api")
public class EnrollmentController {
    private final EnrollmentService enrollmentService;
    public EnrollmentController(EnrollmentService enrollmentService) { this.enrollmentService = enrollmentService; }

    @PostMapping("/enroll")
    @PreAuthorize("@accessPolicy.has(authentication, 'STUDENT_ACADEMIC')")
    public ActionResponse enroll(@Valid @RequestBody EnrollmentRequest request) {
        return new ActionResponse(true, enrollmentService.enroll(request.courseId()));
    }

    @PostMapping("/drop")
    @PreAuthorize("@accessPolicy.has(authentication, 'STUDENT_ACADEMIC')")
    public ActionResponse drop(@Valid @RequestBody EnrollmentRequest request) {
        return new ActionResponse(true, enrollmentService.drop(request.courseId()));
    }

    @PostMapping("/waitlist/leave")
    @PreAuthorize("@accessPolicy.has(authentication, 'STUDENT_ACADEMIC')")
    public ActionResponse leaveWaitlist(@Valid @RequestBody EnrollmentRequest request) {
        return new ActionResponse(true, enrollmentService.leaveWaitlist(request.courseId()));
    }

    @GetMapping("/enrollments/history")
    @PreAuthorize("@accessPolicy.has(authentication, 'STUDENT_ACADEMIC')")
    public List<EnrollmentHistoryDto> history() { return enrollmentService.history(); }
}
