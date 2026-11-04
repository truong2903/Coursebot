package com.courseregistration.service;

import com.courseregistration.dto.RegistrationReportDto;
import com.courseregistration.entity.Enrollment;
import com.courseregistration.entity.WaitlistEntry;
import com.courseregistration.repository.CourseSectionRepository;
import com.courseregistration.repository.EnrollmentRepository;
import com.courseregistration.repository.WaitlistRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class ReportService {
    private final CourseSectionRepository sections;private final EnrollmentRepository enrollments;private final WaitlistRepository waitlists;
    public ReportService(CourseSectionRepository sections,EnrollmentRepository enrollments,WaitlistRepository waitlists){this.sections=sections;this.enrollments=enrollments;this.waitlists=waitlists;}
    @Transactional(readOnly=true)
    public List<RegistrationReportDto> registrations(String semesterCode,String courseCode,String sectionCode){
        var counts=enrollments.activeCountsBySection().stream().collect(java.util.stream.Collectors.toMap(r->(String)r[0],r->((Number)r[1]).longValue()));
        var waiting=waitlists.waitingCountsBySection().stream().collect(java.util.stream.Collectors.toMap(r->(String)r[0],r->((Number)r[1]).longValue()));
        var all=sections.findAll().stream().filter(s->semesterCode==null||semesterCode.isBlank()||s.getSemester().getCode().equalsIgnoreCase(semesterCode))
                .filter(s->courseCode==null||courseCode.isBlank()||s.getCourse().getCode().toLowerCase().contains(courseCode.toLowerCase()))
                .filter(s->sectionCode==null||sectionCode.isBlank()||s.getSectionCode().toLowerCase().contains(sectionCode.toLowerCase())).toList();
        return all.stream().map(section->new RegistrationReportDto(section.getSemester().getName(),section.getCourse().getCode(),section.getCourse().getName(),section.getSectionCode(),section.getStatus().name(),
                section.totalEnrolled(counts.getOrDefault(section.getId(),0L)),section.getCapacity(),waiting.getOrDefault(section.getId(),0L))).toList();
    }
}
