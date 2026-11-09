package com.courseregistration.service;

import com.courseregistration.entity.AuditLog;
import com.courseregistration.repository.AuditLogRepository;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {
    private final AuditLogRepository repository;
    public AuditService(AuditLogRepository repository){this.repository=repository;}

    @Transactional
    public void record(String action,String target,String details){
        Authentication authentication=SecurityContextHolder.getContext().getAuthentication();
        String actor=authentication==null||!authentication.isAuthenticated()?"system":authentication.getName();
        repository.save(new AuditLog(actor,action,target,details));
    }

    @Async
    public void recordAsync(String actor, String action, String target, String details) {
        try {
            repository.save(new AuditLog(actor == null || actor.isBlank() ? "system" : actor, action, target, details));
        } catch (Exception ignored) {
            // Asynchronous audit logging should never interrupt authentication flow
        }
    }
}
