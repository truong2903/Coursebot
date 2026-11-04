package com.courseregistration.dto;

import com.courseregistration.entity.AcademicResult;
import java.math.BigDecimal;

public record AcademicResultDto(
        Long id,
        String semesterCode,
        String semesterName,
        String courseCode,
        String courseName,
        int credits,
        String outcome,
        BigDecimal grade,
        String letterGrade,
        boolean passed,
        boolean retakenAndPassed
) {
    public static AcademicResultDto from(AcademicResult entity, boolean retakenAndPassed) {
        return new AcademicResultDto(
                entity.getId(),
                entity.getSemester().getCode(),
                entity.getSemester().getName(),
                entity.getCourse().getCode(),
                entity.getCourse().getName(),
                entity.getCourse().getCredits(),
                entity.getOutcome(),
                entity.getGrade(),
                entity.getLetterGrade(),
                entity.isPassed(),
                retakenAndPassed
        );
    }
}
