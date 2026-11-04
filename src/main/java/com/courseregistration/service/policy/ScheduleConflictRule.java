package com.courseregistration.service.policy;

import com.courseregistration.entity.CourseSection;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.util.Optional;

@Component
@Order(50)
public class ScheduleConflictRule implements EnrollmentRule {
    @Override
    public Optional<String> checkViolation(EnrollmentValidationContext context) {
        CourseSection target = context.targetSection();
        for (CourseSection existing : context.activeSectionsInSemester()) {
            boolean overlaps = target.getEffectiveMeetings().stream()
                    .anyMatch(a -> existing.getEffectiveMeetings().stream().anyMatch(a::overlaps));
            if (overlaps) {
                return Optional.of("Lịch học bị trùng với " + existing.getCourse().getCode() + ".");
            }
        }
        return Optional.empty();
    }
}
