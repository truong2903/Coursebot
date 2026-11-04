package com.courseregistration.dto;
import com.courseregistration.entity.Semester;
import java.time.LocalDate;
public record SemesterManagementDto(Long id,String code,String name,LocalDate startsAt,LocalDate endsAt,LocalDate registrationOpenAt,LocalDate registrationCloseAt,String status,boolean registrationAlwaysOpen){
 public static SemesterManagementDto from(Semester s){return new SemesterManagementDto(s.getId(),s.getCode(),s.getName(),s.getStartsAt(),s.getEndsAt(),s.getRegistrationOpenAt(),s.getRegistrationCloseAt(),s.getStatus().name(),s.isRegistrationAlwaysOpen());}
}
