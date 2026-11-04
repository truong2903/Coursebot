package com.courseregistration.dto;

public record TrainingSectionDto(String id, String sectionCode, String courseCode, String courseName,
                                 String lecturer, String schedule, String room, int enrolled,
                                 int capacity, String prerequisite) {}
