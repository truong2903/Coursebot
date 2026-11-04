package com.courseregistration.dto;
import jakarta.validation.constraints.*;
public record CourseManagementRequest(@NotBlank @Size(max=20) String code,@NotBlank @Size(max=160) String name,
 @NotBlank @Size(max=120) String department,@Min(0) @Max(12) int credits,String prerequisite,@Size(max=2000) String description,
 @Size(max=500) String syllabusUrl,Boolean active){}
