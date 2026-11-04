package com.courseregistration.dto;

import java.util.List;

public record LecturerDashboardDto(String role, String name, String lecturerCode, String semesterCode, String semester,
                                   int totalStudents, List<LecturerSectionDto> sections) {}
