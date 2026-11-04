package com.courseregistration.dto;
import com.courseregistration.entity.Curriculum;
import jakarta.validation.constraints.NotBlank;
public record CurriculumRequest(@NotBlank String code,@NotBlank String name,@NotBlank String program,@NotBlank String cohort,@NotBlank String version,Curriculum.Status status){}
