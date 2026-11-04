package com.courseregistration.dto;
import jakarta.validation.constraints.*;
public record SectionManagementRequest(String id,@NotBlank String sectionCode,@NotBlank String courseCode,@NotBlank String semesterCode,
 String lecturerCode,String schedule,String room,@Min(1) int capacity,
 @jakarta.validation.constraints.NotNull com.courseregistration.entity.CourseSection.Status status,
 @jakarta.validation.Valid java.util.List<MeetingDto> meetings,@Min(0) Integer importedEnrolled){}
