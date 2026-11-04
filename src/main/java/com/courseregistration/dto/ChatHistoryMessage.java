package com.courseregistration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChatHistoryMessage(@NotBlank @jakarta.validation.constraints.Pattern(regexp="user|assistant") String role, @NotBlank @Size(max=12000) String content) {}
