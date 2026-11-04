package com.courseregistration.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "enrollments", uniqueConstraints = @UniqueConstraint(columnNames = {"student_id", "section_id"}))
public class Enrollment {
    public enum Status { ENROLLED, CANCELLED, PENDING }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Student student;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private CourseSection section;
    @Column(nullable = false)
    private LocalDateTime enrolledAt;
    @Column(nullable=false,columnDefinition="boolean default false") private boolean enrollmentDateOnly;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    protected Enrollment() {}
    public Enrollment(Student student, CourseSection section) {
        this.student = student; this.section = section; this.enrolledAt = LocalDateTime.now(); this.status = Status.ENROLLED;
    }
    public Long getId() { return id; }
    public Student getStudent() { return student; }
    public CourseSection getSection() { return section; }
    public LocalDateTime getEnrolledAt() { return enrolledAt; }
    public boolean isEnrollmentDateOnly() { return enrollmentDateOnly; }
    public Status getStatus() { return status; }
    public void cancel() { this.status = Status.CANCELLED; }
    public void reEnroll() { this.status = Status.ENROLLED; this.enrolledAt = LocalDateTime.now(); this.enrollmentDateOnly=false; }
    public void approve() {
        if (this.status != Status.PENDING) {
            throw new IllegalStateException("Chỉ có thể duyệt bản ghi đang ở trạng thái Chờ xác nhận.");
        }
        this.status = Status.ENROLLED;
        this.enrolledAt = LocalDateTime.now();
        this.enrollmentDateOnly = false;
    }
}
