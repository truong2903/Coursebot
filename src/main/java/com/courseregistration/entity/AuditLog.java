package com.courseregistration.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name="audit_logs")
public class AuditLog {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false,length=80) private String actor;
    @Column(nullable=false,length=80) private String action;
    @Column(length=160) private String target;
    @Column(length=2000) private String details;
    @Column(nullable=false) private LocalDateTime createdAt=LocalDateTime.now();
    protected AuditLog(){}
    public AuditLog(String actor,String action,String target,String details){this.actor=actor;this.action=action;this.target=target;this.details=details;}
    public Long getId(){return id;}public String getActor(){return actor;}public String getAction(){return action;}public String getTarget(){return target;}public String getDetails(){return details;}public LocalDateTime getCreatedAt(){return createdAt;}
}
