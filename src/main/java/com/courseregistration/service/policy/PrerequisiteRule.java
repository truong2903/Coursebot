package com.courseregistration.service.policy;

import com.courseregistration.entity.Course;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.util.Optional;

@Component
@Order(40)
public class PrerequisiteRule implements EnrollmentRule {
    @Override
    public Optional<String> checkViolation(EnrollmentValidationContext context) {
        Course course = context.targetSection().getCourse();
        if (!context.student().getCompletedCourseCodes().containsAll(course.getPrerequisiteCodes())) {
            return Optional.of("Bạn chưa hoàn thành môn tiên quyết: " + course.getPrerequisite() + ".");
        }
        return Optional.empty();
    }
}
