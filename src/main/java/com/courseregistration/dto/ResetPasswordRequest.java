package com.courseregistration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Email;

public record ResetPasswordRequest(@NotBlank @Email String email,@NotBlank @Size(min=6,max=6) String token,@NotBlank @Size(min=10,max=100) String newPassword){}
