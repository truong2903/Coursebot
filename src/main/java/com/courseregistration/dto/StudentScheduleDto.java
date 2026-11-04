package com.courseregistration.dto;

import java.util.List;

public record StudentScheduleDto(String semesterCode, String semesterName, List<SemesterManagementDto> semesters,
                                List<CourseSectionDto> courses) {}
