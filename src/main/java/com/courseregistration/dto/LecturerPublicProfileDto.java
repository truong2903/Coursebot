package com.courseregistration.dto;

import com.courseregistration.entity.CourseSection;
import com.courseregistration.entity.Lecturer;
import java.util.List;

public record LecturerPublicProfileDto(
        String lecturerCode,
        String fullName,
        String department,
        String subjectGroup,
        String academicDegree,
        String academicTitle,
        String email,
        String phone,
        String bio,
        String researchInterests,
        String officeLocation,
        String officeHours,
        String websiteUrl,
        boolean showPhoneToStudents,
        int activeSectionCount,
        List<TeachingSectionDto> currentSections
) {
    public record TeachingSectionDto(
            String sectionId,
            String sectionCode,
            String courseCode,
            String courseName,
            int credits,
            String semesterName,
            String schedule,
            String room,
            int enrolled,
            int capacity,
            String status
    ) {
        public static TeachingSectionDto from(CourseSection section, int enrolled) {
            var course = section.getCourse();
            return new TeachingSectionDto(
                    section.getId(),
                    section.getSectionCode(),
                    course.getCode(),
                    course.getName(),
                    course.getCredits(),
                    section.getSemester().getName(),
                    section.getSchedule(),
                    section.getRoom(),
                    enrolled,
                    section.getCapacity(),
                    section.getStatus().name()
            );
        }
    }

    public static LecturerPublicProfileDto forStudent(Lecturer lecturer, List<TeachingSectionDto> sections) {
        return new LecturerPublicProfileDto(
                lecturer.getLecturerCode(),
                lecturer.getFullName(),
                lecturer.getDepartment(),
                lecturer.getSubjectGroup(),
                lecturer.getAcademicDegree(),
                lecturer.getAcademicTitle(),
                lecturer.getEmail(),
                lecturer.isShowPhoneToStudents() ? lecturer.getPhone() : null,
                lecturer.getBio(),
                lecturer.getResearchInterests(),
                lecturer.getOfficeLocation(),
                lecturer.getOfficeHours(),
                lecturer.getWebsiteUrl(),
                lecturer.isShowPhoneToStudents(),
                sections.size(),
                sections
        );
    }

    public static LecturerPublicProfileDto forSelf(Lecturer lecturer, List<TeachingSectionDto> sections) {
        return new LecturerPublicProfileDto(
                lecturer.getLecturerCode(),
                lecturer.getFullName(),
                lecturer.getDepartment(),
                lecturer.getSubjectGroup(),
                lecturer.getAcademicDegree(),
                lecturer.getAcademicTitle(),
                lecturer.getEmail(),
                lecturer.getPhone(),
                lecturer.getBio(),
                lecturer.getResearchInterests(),
                lecturer.getOfficeLocation(),
                lecturer.getOfficeHours(),
                lecturer.getWebsiteUrl(),
                lecturer.isShowPhoneToStudents(),
                sections.size(),
                sections
        );
    }
}
