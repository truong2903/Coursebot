package com.courseregistration.service.policy;

import com.courseregistration.entity.Course;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Kiểm tra đầy đủ 3 loại điều kiện môn học trong bảng course_conditions:
 * Tiên quyết, Học trước, Song hành (áp dụng cho cả đăng ký trực tiếp và xét duyệt danh sách chờ).
 */
@Component
@Order(45)
public class CourseConditionRule implements EnrollmentRule {
    private final CourseConditionEvaluator evaluator;

    public CourseConditionRule(CourseConditionEvaluator evaluator) {
        this.evaluator = evaluator;
    }

    @Override
    public Optional<String> checkViolation(EnrollmentValidationContext context) {
        Course course = context.targetSection().getCourse();
        Set<String> activeCourseCodes = context.activeSectionsInSemester().stream()
                .map(s -> s.getCourse().getCode())
                .collect(Collectors.toSet());
        var unmet = evaluator.findUnmetRuleConditionsOnly(
                course, context.student(), context.targetSection().getSemester(), activeCourseCodes);
        return evaluator.formatViolationMessage(course, unmet);
    }
}
