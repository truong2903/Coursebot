package com.courseregistration.dto;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
public record CurriculumCourseRequest(@NotBlank String courseCode,@NotBlank String suggestedSemester,boolean requiredCourse,@Min(0) int orderIndex){}
