package com.courseregistration.service.policy;

import com.courseregistration.entity.CourseSection;
import com.courseregistration.service.CourseService;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.util.Optional;

@Component
@Order(10)
public class SectionAvailabilityRule implements EnrollmentRule {
    private final CourseService courseService;

    public SectionAvailabilityRule(CourseService courseService) {
        this.courseService = courseService;
    }

    @Override
    public Optional<String> checkViolation(EnrollmentValidationContext context) {
        CourseSection section = context.targetSection();
        if (!context.directRequest()) {
            return section.getCourse().isActive()
                    ? Optional.empty()
                    : Optional.of("Lớp học phần hiện không mở đăng ký.");
        }
        if (section.getStatus() != CourseSection.Status.OPEN || !section.getCourse().isActive()) {
            return Optional.of("Lớp học phần hiện không mở đăng ký.");
        }
        if (!courseService.registrationOpen(section.getSemester())) {
            return Optional.of("Đợt đăng ký học phần hiện không mở.");
        }
        if (section.isScheduleReviewRequired()) {
            return Optional.of("Lớp còn lịch học hoặc sĩ số chưa xác định. Vui lòng chờ Ban Đào tạo xác nhận.");
        }
        return Optional.empty();
    }
}
