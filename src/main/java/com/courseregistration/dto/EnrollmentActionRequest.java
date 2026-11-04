package com.courseregistration.dto;

import jakarta.validation.constraints.Size;

public record EnrollmentActionRequest(
        @Size(max = 300, message = "Ghi chú tối đa 300 ký tự.")
        String reason
) {}
