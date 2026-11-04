package com.courseregistration.dto;
import com.courseregistration.entity.Curriculum;
public record CurriculumDto(Long id,String code,String name,String program,String cohort,String version,String status){
 public static CurriculumDto from(Curriculum c){return new CurriculumDto(c.getId(),c.getCode(),c.getName(),c.getProgram(),c.getCohort(),c.getVersion(),c.getStatus().name());}
}
