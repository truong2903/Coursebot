package com.courseregistration.controller;

import com.courseregistration.dto.RegistrationReportDto;
import com.courseregistration.service.ReportService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import com.courseregistration.repository.SemesterRepository;
import com.courseregistration.dto.SemesterManagementDto;

@RestController
@RequestMapping("/api/reports")
@PreAuthorize("@accessPolicy.has(authentication, 'REPORTS_VIEW')")
public class ReportController {
    private final ReportService reports;
    private final SemesterRepository semesters;
    public ReportController(ReportService reports,SemesterRepository semesters){this.reports=reports;this.semesters=semesters;}
    @GetMapping public List<RegistrationReportDto> registrations(@RequestParam(required=false) String semester,@RequestParam(required=false) String courseCode,@RequestParam(required=false) String sectionCode){return reports.registrations(semester,courseCode,sectionCode);}
    @GetMapping("/semesters") public List<SemesterManagementDto> semesters(){return semesters.findAllByOrderByStartsAtDesc().stream().map(SemesterManagementDto::from).toList();}
}
