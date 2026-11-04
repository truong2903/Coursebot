package com.courseregistration.dto;

import com.courseregistration.entity.Enrollment;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record EnrollmentAdminDto(
        Long id,
        String studentCode,
        String studentName,
        String program,
        String cohort,
        String semesterCode,
        String semesterName,
        String sectionId,
        String sectionCode,
        String courseCode,
        String courseName,
        int credits,
        String schedule,
        int enrolledCount,
        int capacity,
        String status,
        LocalDateTime enrolledAt,
        boolean enrollmentDateOnly,
        boolean pastStudentDropWindow
) {
    public static EnrollmentAdminDto from(Enrollment e, int enrolledCount, int dropWindowDays) {
        var student = e.getStudent();
        var section = e.getSection();
        var course = section.getCourse();
        var semester = section.getSemester();
        var startsAt = semester.getStartsAt();
        boolean pastDropWindow = (startsAt == null && !semester.isRegistrationAlwaysOpen())
                || (startsAt != null && !LocalDate.now().isBefore(startsAt.plusDays(dropWindowDays)));
        return new EnrollmentAdminDto(
                e.getId(),
                student.getStudentCode(),
                student.getFullName(),
                student.getProgram(),
                student.getCohort(),
                semester.getCode(),
                semester.getName(),
                section.getId(),
                section.getSectionCode(),
                course.getCode(),
                course.getName(),
                course.getCredits(),
                section.getSchedule(),
                enrolledCount,
                section.getCapacity(),
                e.getStatus().name(),
                e.getEnrolledAt(),
                e.isEnrollmentDateOnly(),
                pastDropWindow
        );
    }
}
