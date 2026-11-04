package com.courseregistration.entity;

import jakarta.persistence.*;
import java.util.Objects;
import java.util.Set;

@Entity
@Table(
    name = "course_conditions",
    uniqueConstraints = @UniqueConstraint(columnNames = {"course_id", "condition_course_id", "condition_type"})
)
public class CourseCondition {
    public static final String TYPE_PREREQUISITE = "Tiên quyết";
    public static final String TYPE_PRIOR_STUDY = "Học trước";
    public static final String TYPE_COREQUISITE = "Song hành";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Course course;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "condition_course_id")
    private Course conditionCourse;

    @Column(nullable = false, length = 40)
    private String conditionType;

    protected CourseCondition() {}

    public CourseCondition(Course course, Course conditionCourse, String conditionType) {
        this.course = Objects.requireNonNull(course, "Học phần không được để trống");
        this.conditionCourse = Objects.requireNonNull(conditionCourse, "Học phần điều kiện không được để trống");
        if (course.getCode().equalsIgnoreCase(conditionCourse.getCode())) {
            throw new IllegalArgumentException("Môn học không thể là điều kiện của chính nó.");
        }
        this.conditionType = Objects.requireNonNull(conditionType, "Loại điều kiện không được để trống").trim();
    }

    public Long getId() { return id; }
    public Course getCourse() { return course; }
    public Course getConditionCourse() { return conditionCourse; }
    public String getConditionType() { return conditionType; }

    public boolean isPrerequisite() {
        return TYPE_PREREQUISITE.equals(conditionType);
    }

    public boolean isSatisfiedBy(Set<String> completedCodes, Set<String> priorStudiedCodes, Set<String> concurrentCodes) {
        return evaluate(conditionType, conditionCourse.getCode(), completedCodes, priorStudiedCodes, concurrentCodes);
    }

    public static boolean evaluate(String type, String requiredCourseCode,
                                   Set<String> completedCodes,
                                   Set<String> priorStudiedCodes,
                                   Set<String> concurrentCodes) {
        if (type == null || requiredCourseCode == null) {
            return false;
        }
        return switch (type) {
            case TYPE_PREREQUISITE -> completedCodes.contains(requiredCourseCode);
            case TYPE_PRIOR_STUDY -> priorStudiedCodes.contains(requiredCourseCode);
            case TYPE_COREQUISITE -> completedCodes.contains(requiredCourseCode) || concurrentCodes.contains(requiredCourseCode);
            default -> false;
        };
    }
}
