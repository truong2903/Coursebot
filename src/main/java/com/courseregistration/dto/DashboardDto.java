package com.courseregistration.dto;

import java.util.List;
import java.time.LocalDate;

public record DashboardDto(StudentDto student, List<CourseSectionDto> courses,
                          List<CourseSectionDto> registered, int credits, int maxCredits,
                          String semesterCode, String semesterName, LocalDate registrationOpenAt,
                          LocalDate registrationCloseAt, boolean registrationOpen,int dropWindowDays,
                          boolean registrationAlwaysOpen,LocalDate semesterStartsAt) {}
