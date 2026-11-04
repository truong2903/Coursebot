package com.courseregistration.dto;
import com.courseregistration.entity.CourseSection;
public record SectionManagementDto(String id,String sectionCode,String courseCode,String courseName,String semesterCode,String lecturerCode,String lecturerName,String schedule,String room,int capacity,int enrolled,String status,java.util.List<MeetingDto> meetings,boolean scheduleReviewRequired,Integer importedEnrolled){
 public static SectionManagementDto from(CourseSection s,int enrolled){return new SectionManagementDto(s.getId(),s.getSectionCode(),s.getCourse().getCode(),s.getCourse().getName(),s.getSemester().getCode(),s.getLecturerCode(),s.getLecturerName(),s.getSchedule(),s.getRoom(),s.getCapacity(),enrolled,s.getStatus().name(),s.getEffectiveMeetings().stream().map(MeetingDto::from).toList(),s.isScheduleReviewRequired(),s.getImportedEnrolled());}
}
