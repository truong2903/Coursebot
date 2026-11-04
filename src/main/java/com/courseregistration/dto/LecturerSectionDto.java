package com.courseregistration.dto;

public record LecturerSectionDto(String id, String sectionCode, String courseCode, String courseName,
                                 String schedule, String room, int studentCount, int capacity,java.util.List<MeetingDto> meetings) {}
