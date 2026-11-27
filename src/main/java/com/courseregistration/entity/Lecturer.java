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
    @Column(length=1200) private String bio;
    @Column(length=500) private String researchInterests;
    @Column(length=160) private String officeLocation;
    @Column(length=240) private String officeHours;
    @Column(length=300) private String websiteUrl;
    @Column(nullable=false, columnDefinition="boolean default false")
    private boolean showPhoneToStudents = false;

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
    public String getBio() { return bio; }
    public String getResearchInterests() { return researchInterests; }
    public String getOfficeLocation() { return officeLocation; }
    public String getOfficeHours() { return officeHours; }
    public String getWebsiteUrl() { return websiteUrl; }
    public boolean isShowPhoneToStudents() { return showPhoneToStudents; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public void setDepartment(String department) { this.department = department; }
    public void updatePublicProfile(String bio, String researchInterests, String officeLocation,
                                    String officeHours, String websiteUrl, String email,
                                    String phone, boolean showPhoneToStudents) {
        this.bio = normalizeText(bio);
        this.researchInterests = normalizeText(researchInterests);
        this.officeLocation = normalizeText(officeLocation);
        this.officeHours = normalizeText(officeHours);
        this.websiteUrl = normalizeText(websiteUrl);
        this.email = normalizeText(email);
        this.phone = normalizeText(phone);
        this.showPhoneToStudents = showPhoneToStudents;
    }
    private static String normalizeText(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
