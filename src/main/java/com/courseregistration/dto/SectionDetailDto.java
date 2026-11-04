package com.courseregistration.dto;

public record SectionDetailDto(String id,String sectionCode,String courseCode,String courseName,int credits,String semester,
        String lecturer,String schedule,String room,int capacity,int enrolled,int remaining,String status,String prerequisite,
        String description,String syllabusUrl,java.util.List<MeetingDto> meetings) {}
