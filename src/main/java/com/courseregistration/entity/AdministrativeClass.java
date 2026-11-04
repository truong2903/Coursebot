package com.courseregistration.entity;

import jakarta.persistence.*;
import java.util.Objects;

@Entity
@Table(name = "administrative_classes")
public class AdministrativeClass {
    @Id
    @Column(length = 40)
    private String code;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "program_code")
    private AcademicProgram program;

    @Column(nullable = false, length = 20)
    private String cohort;

    protected AdministrativeClass() {}

    public AdministrativeClass(String code, AcademicProgram program, String cohort) {
        this.code = Objects.requireNonNull(code, "Mã lớp hành chính không được để trống").trim();
        update(program, cohort);
    }

    public String getCode() { return code; }
    public AcademicProgram getProgram() { return program; }
    public String getCohort() { return cohort; }

    public void update(AcademicProgram program, String cohort) {
        this.program = Objects.requireNonNull(program, "Ngành đào tạo không được để trống");
        this.cohort = Objects.requireNonNull(cohort, "Khóa học không được để trống").trim();
    }
}
