package com.courseregistration.dto;

import jakarta.validation.constraints.NotBlank;

public record EnrollmentRequest(@NotBlank String courseId) {}
