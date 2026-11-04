package com.courseregistration.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity @Table(name="academic_data_imports")
public class AcademicDataImport {
    @Id @Column(length=64) private String sha256;
    @Column(nullable=false) private LocalDateTime importedAt;
    @Column(columnDefinition="TEXT") private String manifestJson;
    protected AcademicDataImport() {}
}
