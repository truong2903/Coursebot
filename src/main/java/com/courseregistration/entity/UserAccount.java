package com.courseregistration.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_accounts")
public class UserAccount {
    public enum Role { STUDENT, LECTURER, TRAINING_OFFICE, ADMIN }
    public enum Status { ACTIVE, LOCKED, DISABLED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 80)
    private String username;
    @Column(nullable = false, length = 120)
    private String passwordHash;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 24)
    private Role role;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 24)
    private Status status = Status.ACTIVE;
    @Column(length = 30)
    private String studentCode;
    @Column(length = 30)
    private String lecturerCode;
    @Column(length = 160)
    private String email;
    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    protected UserAccount() {}
    public UserAccount(String username, String passwordHash, Role role, String studentCode, String lecturerCode, String email) {
        this.username = username;
        this.passwordHash = passwordHash;
        this.role = role;
        this.studentCode = studentCode;
        this.lecturerCode = lecturerCode;
        this.email = email;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getPasswordHash() { return passwordHash; }
    public Role getRole() { return role; }
    public Status getStatus() { return status; }
    public String getStudentCode() { return studentCode; }
    public String getLecturerCode() { return lecturerCode; }
    public String getEmail() { return email; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; touch(); }
    public void setUsername(String username) { this.username = username; touch(); }
    public void setRole(Role role) { this.role = role; touch(); }
    public void setStatus(Status status) { this.status = status; touch(); }
    public void setStudentCode(String studentCode) { this.studentCode = studentCode; touch(); }
    public void setLecturerCode(String lecturerCode) { this.lecturerCode = lecturerCode; touch(); }
    public void setEmail(String email) { this.email = email; touch(); }
    private void touch() { this.updatedAt = LocalDateTime.now(); }
}
