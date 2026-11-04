package com.courseregistration.controller;

import com.courseregistration.dto.*;
import com.courseregistration.service.WorkspaceService;
import com.courseregistration.service.StudentAcademicService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/workspace")
public class WorkspaceController {
    private final WorkspaceService workspaceService;
    private final StudentAcademicService studentAcademicService;
    public WorkspaceController(WorkspaceService workspaceService,StudentAcademicService studentAcademicService) { this.workspaceService = workspaceService;this.studentAcademicService=studentAcademicService; }

    @GetMapping("/lecturer")
    @PreAuthorize("@accessPolicy.has(authentication, 'LECTURER_WORKSPACE')")
    public LecturerDashboardDto lecturer(@RequestParam(required=false) String semester) { return workspaceService.lecturerDashboard(semester); }

    @GetMapping("/lecturer/semesters")
    @PreAuthorize("@accessPolicy.has(authentication, 'LECTURER_WORKSPACE')")
    public List<SemesterManagementDto> lecturerSemesters() { return workspaceService.lecturerSemesters(); }

    @GetMapping("/lecturer/sections/{sectionId}/students")
    @PreAuthorize("@accessPolicy.has(authentication, 'LECTURER_WORKSPACE')")
    public List<RosterStudentDto> classRoster(@PathVariable String sectionId) {
        return workspaceService.classRoster(sectionId);
    }

    @GetMapping("/lecturer/sections/{sectionId}")
    @PreAuthorize("@accessPolicy.has(authentication, 'LECTURER_WORKSPACE')")
    public SectionDetailDto lecturerSectionDetails(@PathVariable String sectionId) { return workspaceService.lecturerSectionDetails(sectionId); }

    @GetMapping("/lecturer/curricula")
    @PreAuthorize("@accessPolicy.has(authentication, 'LECTURER_WORKSPACE')")
    public List<CurriculumDto> lecturerCurricula() { return studentAcademicService.activeCurricula(); }

    @GetMapping("/lecturer/curricula/{code}")
    @PreAuthorize("@accessPolicy.has(authentication, 'LECTURER_WORKSPACE')")
    public StudentCurriculumDto lecturerCurriculum(@PathVariable String code) { return studentAcademicService.curriculum(code); }

    @GetMapping("/training-office")
    @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_READ')")
    public TrainingDashboardDto trainingOffice() { return workspaceService.trainingDashboard(); }

    @GetMapping("/admin")
    @PreAuthorize("@accessPolicy.has(authentication, 'ACCOUNTS_MANAGE')")
    public AdminDashboardDto admin() { return workspaceService.adminDashboard(); }
}
