package com.courseregistration.service.policy;

import java.util.Optional;

/**
 * Strategy / Specification Pattern cho từng quy tắc nghiệp vụ đăng ký học phần.
 * Cho phép mở rộng quy tắc mới (Open/Closed Principle) mà không sửa đổi EnrollmentService.
 */
public interface EnrollmentRule {
    Optional<String> checkViolation(EnrollmentValidationContext context);

    default void validate(EnrollmentValidationContext context) {
        checkViolation(context).ifPresent(message -> {
            throw new IllegalStateException(message);
        });
    }
}
