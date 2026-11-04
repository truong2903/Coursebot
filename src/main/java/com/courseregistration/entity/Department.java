package com.courseregistration.entity;

import jakarta.persistence.*;
import java.util.Objects;

@Entity
@Table(name = "departments")
public class Department {
    @Id
    @Column(length = 40)
    private String code;

    @Column(nullable = false, length = 160)
    private String name;

    protected Department() {}

    public Department(String code, String name) {
        this.code = Objects.requireNonNull(code, "Mã khoa không được để trống").trim();
        this.name = Objects.requireNonNull(name, "Tên khoa không được để trống").trim();
    }

    public String getCode() { return code; }
    public String getName() { return name; }

    public void rename(String name) {
        this.name = Objects.requireNonNull(name, "Tên khoa không được để trống").trim();
    }
}
