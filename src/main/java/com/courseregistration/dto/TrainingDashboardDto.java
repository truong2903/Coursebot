package com.courseregistration.dto;

import java.time.LocalDate;
import java.util.List;

public record TrainingDashboardDto(String role, String semester, LocalDate registrationOpenAt,
                                   LocalDate registrationCloseAt, long studentCount, long courseCount,
                                   long sectionCount, long enrollmentCount, long waitingListCount,
                                   long pendingCount, List<TrainingSectionDto> sections) {}
