package com.courseregistration.dto;

import com.courseregistration.entity.Enrollment;

import java.time.LocalDateTime;

public record EnrollmentHistoryDto(Long id, String sectionId, String sectionCode, String semesterCode, String semesterName, String courseCode,
                                   String courseName, int credits, String schedule, String status,
                                   LocalDateTime enrolledAt, boolean enrollmentDateOnly) {
    public static EnrollmentHistoryDto from(Enrollment enrollment) {
        var section = enrollment.getSection();
        var course = section.getCourse();
        return new EnrollmentHistoryDto(enrollment.getId(), section.getId(), section.getSectionCode(), section.getSemester().getCode(), section.getSemester().getName(),
                course.getCode(), course.getName(), course.getCredits(), section.getSchedule(),
                enrollment.getStatus().name(), enrollment.getEnrolledAt(), enrollment.isEnrollmentDateOnly());
    }
}
