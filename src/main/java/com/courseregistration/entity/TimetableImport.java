package com.courseregistration.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name="timetable_app_imports")
public class TimetableImport {
    @Id @Column(length=64) private String sha256;
    @Column(nullable=false) private LocalDateTime importedAt;
    protected TimetableImport(){}
}
