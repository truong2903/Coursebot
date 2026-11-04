package com.courseregistration.dto;

import com.courseregistration.entity.UserAccount;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AccountManagementRequest(
        @NotBlank @Size(min = 3, max = 80) String username,
        @Size(min = 10, max = 100) String password,
        @NotNull UserAccount.Role role,
        UserAccount.Status status,
        String studentCode,
        String lecturerCode,
        String displayName,
        String program,
        String cohort,
        String department,
        @Email String email) {}
