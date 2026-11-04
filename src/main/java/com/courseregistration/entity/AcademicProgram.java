package com.courseregistration.entity;

import jakarta.persistence.*;
import java.util.Objects;

@Entity
@Table(name = "academic_programs")
public class AcademicProgram {
    @Id
    @Column(length = 40)
    private String code;

    @Column(nullable = false, length = 160)
    private String name;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "department_code")
    private Department department;

    protected AcademicProgram() {}

    public AcademicProgram(String code, String name, Department department) {
        this.code = Objects.requireNonNull(code, "Mã ngành không được để trống").trim();
        update(name, department);
    }

    public String getCode() { return code; }
    public String getName() { return name; }
    public Department getDepartment() { return department; }

    public void update(String name, Department department) {
        this.name = Objects.requireNonNull(name, "Tên ngành không được để trống").trim();
        this.department = Objects.requireNonNull(department, "Khoa quản lý không được để trống");
    }
}
