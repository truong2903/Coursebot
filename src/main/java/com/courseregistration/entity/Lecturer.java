package com.courseregistration.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "lecturers")
public class Lecturer {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 30)
    private String lecturerCode;
    @Column(nullable = false, length = 120)
    private String fullName;
    @Column(nullable = false, length = 120)
    private String department;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="academic_department_code") private Department academicDepartment;
    @Column(length=160) private String subjectGroup;
    @Column(length=80) private String academicDegree;
    @Column(length=80) private String academicTitle;
    @Column(length=30) private String phone;
    @Column(length=160) private String email;

    protected Lecturer() {}
    public Lecturer(String lecturerCode, String fullName, String department) {
        this.lecturerCode = lecturerCode; this.fullName = fullName; this.department = department;
    }
    public Long getId() { return id; }
    public String getLecturerCode() { return lecturerCode; }
    public String getFullName() { return fullName; }
    public String getDepartment() { return department; }
    public Department getAcademicDepartment() { return academicDepartment; }
    public String getSubjectGroup() { return subjectGroup; }
    public String getAcademicDegree() { return academicDegree; }
    public String getAcademicTitle() { return academicTitle; }
    public String getPhone() { return phone; }
    public String getEmail() { return email; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public void setDepartment(String department) { this.department = department; }
}
