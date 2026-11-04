package com.courseregistration.controller;

import com.courseregistration.dto.CurriculumDto;
import com.courseregistration.dto.StudentCurriculumDto;
import com.courseregistration.dto.StudentScheduleDto;
import com.courseregistration.dto.StudentTranscriptDto;
import com.courseregistration.service.StudentAcademicService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/student")
@PreAuthorize("@accessPolicy.has(authentication, 'STUDENT_ACADEMIC')")
public class StudentAcademicController {
    private final StudentAcademicService service;
    public StudentAcademicController(StudentAcademicService service) { this.service = service; }

    @GetMapping("/curricula")
    public List<CurriculumDto> curricula() { return service.activeCurricula(); }

    @GetMapping("/curriculum")
    public StudentCurriculumDto curriculum(@RequestParam(required = false) String code) {
        return code == null || code.isBlank() ? service.curriculum() : service.curriculum(code);
    }

    @GetMapping("/schedule")
    public StudentScheduleDto schedule(@RequestParam(required = false) String semester) {
        return service.schedule(semester);
    }

    @GetMapping("/transcript")
    public StudentTranscriptDto transcript() {
        return service.transcript();
    }
}
