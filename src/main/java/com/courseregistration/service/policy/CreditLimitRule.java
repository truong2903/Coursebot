package com.courseregistration.service.policy;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.util.Optional;

@Component
@Order(30)
public class CreditLimitRule implements EnrollmentRule {
    private final int maxCredits;

    public CreditLimitRule(@Value("${app.enrollment.max-credits:20}") int maxCredits) {
        this.maxCredits = maxCredits;
    }

    @Override
    public Optional<String> checkViolation(EnrollmentValidationContext context) {
        int projectedCredits = context.currentCreditsInSemester() + context.targetSection().getCourse().getCredits();
        if (projectedCredits > maxCredits) {
            return Optional.of("Đăng ký vượt quá giới hạn " + maxCredits + " tín chỉ.");
        }
        return Optional.empty();
    }
}
