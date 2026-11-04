package com.courseregistration.service.policy;

import com.courseregistration.entity.CourseSection;
import com.courseregistration.entity.Student;
import java.util.List;

/**
 * Ngữ cảnh kiểm tra điều kiện đăng ký học phần hoặc xét duyệt từ danh sách chờ.
 */
public record EnrollmentValidationContext(
        Student student,
        CourseSection targetSection,
        List<CourseSection> activeSectionsInSemester,
        boolean alreadyEnrolledInTarget,
        boolean directRequest
) {
    public int currentCreditsInSemester() {
        return activeSectionsInSemester.stream()
                .mapToInt(section -> section.getCourse().getCredits())
                .sum();
    }
}
