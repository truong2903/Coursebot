package com.courseregistration.dto;
import com.courseregistration.entity.Course;
public record CourseManagementDto(Long id,String code,String name,String department,int credits,String prerequisite,String description,String syllabusUrl,boolean active){
 public static CourseManagementDto from(Course c){return new CourseManagementDto(c.getId(),c.getCode(),c.getName(),c.getDepartment(),c.getCredits(),c.getPrerequisite(),c.getDescription(),c.getSyllabusUrl(),c.isActive());}
}
