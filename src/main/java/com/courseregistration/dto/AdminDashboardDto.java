package com.courseregistration.dto;

public record AdminDashboardDto(String role, long studentAccounts, long lecturerAccounts,
                                long courses, long courseSections, long activeEnrollments,
                                String note) {}
