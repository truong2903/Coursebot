package com.courseregistration.entity;

import jakarta.persistence.*;
import java.time.LocalTime;
import java.util.Objects;

@Entity
@Table(name = "teaching_periods")
public class TeachingPeriod {
    @Id
    private Integer code;

    @Column(nullable = false)
    private LocalTime startsAt;

    @Column(nullable = false)
    private LocalTime endsAt;

    @Column(nullable = false, length = 20)
    private String sessionName;

    @Column(nullable = false, length = 100)
    private String confirmationStatus;

    protected TeachingPeriod() {}

    public TeachingPeriod(Integer code, LocalTime startsAt, LocalTime endsAt,
                          String sessionName, String confirmationStatus) {
        this.code = Objects.requireNonNull(code, "Mã tiết không được để trống");
        this.startsAt = Objects.requireNonNull(startsAt, "Giờ bắt đầu không được để trống");
        this.endsAt = Objects.requireNonNull(endsAt, "Giờ kết thúc không được để trống");
        if (!startsAt.isBefore(endsAt)) {
            throw new IllegalArgumentException("Giờ bắt đầu tiết học phải trước giờ kết thúc.");
        }
        this.sessionName = Objects.requireNonNull(sessionName, "Buổi học không được để trống").trim();
        this.confirmationStatus = Objects.requireNonNull(confirmationStatus, "Trạng thái xác nhận không được để trống").trim();
    }

    public Integer getCode() { return code; }
    public LocalTime getStartsAt() { return startsAt; }
    public LocalTime getEndsAt() { return endsAt; }
    public String getSessionName() { return sessionName; }
    public String getConfirmationStatus() { return confirmationStatus; }
}
