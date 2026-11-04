package com.courseregistration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChatRequest(@NotBlank @Size(max = 1000) String message, @Size(max=12) java.util.List<@jakarta.validation.constraints.NotNull @jakarta.validation.Valid ChatHistoryMessage> history) {}
