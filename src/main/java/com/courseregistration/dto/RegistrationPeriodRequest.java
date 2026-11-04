package com.courseregistration.dto;
import com.courseregistration.entity.RegistrationPeriod;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
public record RegistrationPeriodRequest(@NotBlank String semesterCode,@NotNull LocalDateTime startsAt,@NotNull LocalDateTime endsAt,@NotNull RegistrationPeriod.Status status){}
