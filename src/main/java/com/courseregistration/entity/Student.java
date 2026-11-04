package com.courseregistration.entity;

import jakarta.persistence.*;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "students")
public class Student {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 30)
    private String studentCode;
    @Column(nullable = false, length = 120)
    private String fullName;
    @Column(nullable = false, length = 120)
    private String program;
    @Column(length = 20)
    private String cohort;
    @Column(length = 160)
    private String email;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="administrative_class_code")
    private AdministrativeClass administrativeClass;
    @Column(length=30) private String phone;
    @Column(length=40) private String studyStatus;
    @ElementCollection
    @CollectionTable(name = "student_completed_courses", joinColumns = @JoinColumn(name = "student_id"))
    @Column(name = "course_code", length = 20)
    private Set<String> completedCourseCodes = new LinkedHashSet<>();

    protected Student() {}
    public Student(String studentCode, String fullName, String program, String email) {
        this.studentCode = studentCode; this.fullName = fullName; this.program = program; this.email = email;
    }
    public Student(String studentCode, String fullName, String program, String email, Set<String> completedCourseCodes) {
        this(studentCode, fullName, program, email); this.completedCourseCodes.addAll(completedCourseCodes);
    }
    public Long getId() { return id; }
    public String getStudentCode() { return studentCode; }
    public String getFullName() { return fullName; }
    public String getProgram() { return program; }
    public String getCohort(){return cohort;}
    public String getEmail() { return email; }
    public AdministrativeClass getAdministrativeClass() { return administrativeClass; }
    public String getPhone() { return phone; }
    public String getStudyStatus() { return studyStatus; }
    public Set<String> getCompletedCourseCodes() { return completedCourseCodes; }
    public void setCompletedCourseCodes(Set<String> courseCodes) {
        this.completedCourseCodes = new LinkedHashSet<>(courseCodes);
    }
    public void updateProfile(String fullName, String program, String email) {
        updateProfile(fullName,program,null,email);
    }
    public void updateProfile(String fullName,String program,String cohort,String email) {
        this.fullName = fullName; this.program = program; this.cohort=cohort;this.email = email;
    }
}
