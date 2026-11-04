package com.courseregistration.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "waitlist_entries", uniqueConstraints = @UniqueConstraint(columnNames = {"student_id", "section_id"}))
public class WaitlistEntry {
    public enum Status { WAITING, PROMOTED, CANCELLED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Student student;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private CourseSection section;
    @Column(nullable = false)
    private LocalDateTime createdAt;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    protected WaitlistEntry() {}
    public WaitlistEntry(Student student, CourseSection section) {
        this.student = student; this.section = section; this.createdAt = LocalDateTime.now(); this.status = Status.WAITING;
    }
    public Long getId() { return id; }
    public Student getStudent() { return student; }
    public CourseSection getSection() { return section; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Status getStatus() { return status; }
    public void promote() { this.status = Status.PROMOTED; }
    public void cancel() { this.status = Status.CANCELLED; }
    public void rejoin() { this.status = Status.WAITING; this.createdAt = LocalDateTime.now(); }
}
