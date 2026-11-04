package com.courseregistration.dto;
import com.courseregistration.entity.AuditLog;
import java.time.LocalDateTime;
public record AuditLogDto(Long id,LocalDateTime createdAt,String actor,String role,String action,String target,String details){
 public static AuditLogDto from(AuditLog x,String role){return new AuditLogDto(x.getId(),x.getCreatedAt(),x.getActor(),role,x.getAction(),x.getTarget(),x.getDetails());}
}
