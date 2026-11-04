package com.courseregistration.dto;

import java.math.BigDecimal;
import java.util.List;

public record StudentTranscriptDto(
        String studentCode,
        String fullName,
        String program,
        String cohort,
        int totalRecords,
        int completedCourseCount,
        int accumulatedCredits,
        BigDecimal weightedAverageGrade10,
        List<AcademicResultDto> results
) {}
