package com.courseregistration.dto;
import com.courseregistration.entity.Semester;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
public record SemesterManagementRequest(@NotBlank String code,@NotBlank String name,LocalDate startsAt,LocalDate endsAt,
 LocalDate registrationOpenAt,LocalDate registrationCloseAt,@NotNull Semester.Status status,Boolean registrationAlwaysOpen){}
