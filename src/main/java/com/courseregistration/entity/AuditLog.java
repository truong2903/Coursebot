package com.courseregistration.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Entity
@Table(name="audit_logs")
public class AuditLog {
    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false,length=80) private String actor;
    @Column(nullable=false,length=80) private String action;
    @Column(length=160) private String target;
    @Column(length=2000) private String details;
    @Column(nullable=false) private LocalDateTime createdAt=LocalDateTime.now(APP_ZONE);
    protected AuditLog(){}
    public AuditLog(String actor,String action,String target,String details){this.actor=actor;this.action=action;this.target=target;this.details=details;this.createdAt=LocalDateTime.now(APP_ZONE);}
    public Long getId(){return id;}public String getActor(){return actor;}public String getAction(){return action;}public String getTarget(){return target;}public String getDetails(){return details;}public LocalDateTime getCreatedAt(){return createdAt;}
}
