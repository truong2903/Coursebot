package com.courseregistration.dto;
import com.courseregistration.entity.CurriculumCourse;
public record CurriculumCourseDto(Long id,String curriculumCode,String courseCode,String courseName,int credits,String suggestedSemester,boolean requiredCourse,int orderIndex,String prerequisite,String description,String syllabusUrl){
 public static CurriculumCourseDto from(CurriculumCourse x){return new CurriculumCourseDto(x.getId(),x.getCurriculum().getCode(),x.getCourse().getCode(),x.getCourse().getName(),x.getCourse().getCredits(),x.getSuggestedSemester(),x.isRequiredCourse(),x.getOrderIndex(),x.getCourse().getPrerequisite(),x.getCourse().getDescription(),x.getCourse().getSyllabusUrl());}
}
