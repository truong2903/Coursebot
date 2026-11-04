package com.courseregistration.service.policy;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.util.Optional;

@Component
@Order(20)
public class DuplicateEnrollmentRule implements EnrollmentRule {
    @Override
    public Optional<String> checkViolation(EnrollmentValidationContext context) {
        String targetId = context.targetSection().getId();
        boolean duplicateSection = context.alreadyEnrolledInTarget()
                || context.activeSectionsInSemester().stream().anyMatch(s -> s.getId().equals(targetId));
        return duplicateSection
                ? Optional.of("Bạn đã đăng ký học phần này rồi.")
                : Optional.empty();
    }
}
