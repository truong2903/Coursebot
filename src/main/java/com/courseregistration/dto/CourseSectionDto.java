package com.courseregistration.dto;

import com.courseregistration.entity.CourseSection;

public record CourseSectionDto(String id, String sectionCode, String code, String name, String department,
                               int credits, String instructor, String schedule, String room, String color,
                               int enrolled, int capacity, String prerequisite, boolean registered,
                               boolean prerequisiteMet, boolean waitlisted, int waitlistPosition, String status,
                               String description, String syllabusUrl, java.util.List<MeetingDto> meetings,
                               boolean scheduleReviewRequired, Integer importedEnrolled, String sourceStatus,
                               String sectionType, String linkedSectionCode,
                               String conditionBlockReason, String unmetConditionMessage) {
    public static CourseSectionDto from(CourseSection section, int enrolled, String prerequisite,
                                        boolean registered, boolean prerequisiteMet, boolean waitlisted, int waitlistPosition) {
        return from(section, enrolled, prerequisite, registered, prerequisiteMet, waitlisted, waitlistPosition, null, null);
    }

    public static CourseSectionDto from(CourseSection section, int enrolled, String prerequisite,
                                        boolean registered, boolean prerequisiteMet, boolean waitlisted, int waitlistPosition,
                                        String conditionBlockReason, String unmetConditionMessage) {
        var course = section.getCourse();
        return new CourseSectionDto(section.getId(), section.getSectionCode(), course.getCode(), course.getName(),
                course.getDepartment(), course.getCredits(), section.getLecturerName(), section.getSchedule(),
                section.getRoom(), section.getColor(), enrolled, section.getCapacity(), prerequisite, registered,
                prerequisiteMet, waitlisted, waitlistPosition, section.getStatus().name(), course.getDescription(), course.getSyllabusUrl(),
                section.getEffectiveMeetings().stream().map(MeetingDto::from).toList(), section.isScheduleReviewRequired(),
                section.getImportedEnrolled(), section.getSourceStatus(), section.getSectionType(), section.getLinkedSectionCode(),
                conditionBlockReason, unmetConditionMessage);
    }
}
