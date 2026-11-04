package com.courseregistration.entity;

import jakarta.persistence.*;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "courses")
public class Course {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 20)
    private String code;
    @Column(nullable = false, length = 160)
    private String name;
    @Column(nullable = false, length = 120)
    private String department;
    @Column(nullable = false)
    private int credits;
    @Column(nullable = false, length = 160)
    private String prerequisite;
    @Column(length = 2000)
    private String description;
    @Column(length = 500)
    private String syllabusUrl;
    @Column(nullable = true)
    private boolean active = true;
    @ElementCollection
    @CollectionTable(name = "course_prerequisites", joinColumns = @JoinColumn(name = "course_id"))
    @Column(name = "prerequisite_code", length = 20)
    private Set<String> prerequisiteCodes = new LinkedHashSet<>();

    protected Course() {}
    public Course(String code, String name, String department, int credits, String prerequisite) {
        this.code = code; this.name = name; this.department = department; this.credits = credits; this.prerequisite = prerequisite;
    }
    public Course(String code, String name, String department, int credits, String prerequisite, String... prerequisiteCodes) {
        this(code, name, department, credits, prerequisite);
        this.prerequisiteCodes.addAll(Set.of(prerequisiteCodes));
    }
    public Long getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public String getDepartment() { return department; }
    public int getCredits() { return credits; }
    public String getPrerequisite() { return prerequisite; }
    public String getDescription() { return description; }
    public String getSyllabusUrl() { return syllabusUrl; }
    public boolean isActive() { return active; }
    public Set<String> getPrerequisiteCodes() { return prerequisiteCodes; }
    public void setPrerequisiteCodes(Set<String> courseCodes) {
        this.prerequisiteCodes = new LinkedHashSet<>(courseCodes);
    }
    public void setPrerequisite(String prerequisite){this.prerequisite=prerequisite;}
    public void setSyllabusUrl(String syllabusUrl) { this.syllabusUrl = syllabusUrl; }
    public void update(String name,String department,int credits,String prerequisite,String description) {
        this.name=name;this.department=department;this.credits=credits;this.prerequisite=prerequisite;this.description=description;
    }
    public void setActive(boolean active){this.active=active;}
}
