package com.courseregistration.dto;
import com.courseregistration.entity.RegistrationPeriod;
import java.time.LocalDateTime;
public record RegistrationPeriodDto(Long id,String semesterCode,String semesterName,LocalDateTime startsAt,LocalDateTime endsAt,String status){
 public static RegistrationPeriodDto from(RegistrationPeriod p){return new RegistrationPeriodDto(p.getId(),p.getSemester().getCode(),p.getSemester().getName(),p.getStartsAt(),p.getEndsAt(),p.getEffectiveStatus().name());}
}
