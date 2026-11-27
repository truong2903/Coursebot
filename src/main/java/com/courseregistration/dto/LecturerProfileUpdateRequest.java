package com.courseregistration.dto;

public record LecturerProfileUpdateRequest(
        String bio,
        String researchInterests,
        String officeLocation,
        String officeHours,
        String websiteUrl,
        String email,
        String phone,
        Boolean showPhoneToStudents
) {}
