package com.courseregistration.dto;
public record RegistrationReportDto(String semester,String courseCode,String courseName,String sectionCode,String status,long enrolled,int capacity,long waitlisted){}
