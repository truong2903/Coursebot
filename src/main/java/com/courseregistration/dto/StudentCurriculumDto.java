package com.courseregistration.dto;
import java.util.List;
public record StudentCurriculumDto(CurriculumDto curriculum,List<CurriculumCourseDto> courses){}
