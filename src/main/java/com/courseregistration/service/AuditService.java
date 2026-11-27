package com.courseregistration.service;

import com.courseregistration.entity.AuditLog;
import com.courseregistration.repository.AuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {
    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private final AuditLogRepository repository;
    public AuditService(AuditLogRepository repository){this.repository=repository;}

    @Transactional
    public void record(String action,String target,String details){
        Authentication authentication=SecurityContextHolder.getContext().getAuthentication();
        String name=authentication==null||!authentication.isAuthenticated()?null:authentication.getName();
        String actor=name==null||name.isBlank()||"anonymousUser".equalsIgnoreCase(name)?"system":name;
        repository.save(new AuditLog(truncate(actor, 80), truncate(action, 80), truncate(target, 160), truncate(details, 2000)));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordExplicit(String actor, String action, String target, String details) {
        String safeActor = actor == null || actor.isBlank() || "anonymousUser".equalsIgnoreCase(actor) ? "system" : actor.trim();
        repository.save(new AuditLog(truncate(safeActor, 80), truncate(action, 80), truncate(target, 160), truncate(details, 2000)));
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordAsync(String actor, String action, String target, String details) {
        try {
            String safeActor = actor == null || actor.isBlank() || "anonymousUser".equalsIgnoreCase(actor) ? "system" : actor.trim();
            repository.save(new AuditLog(truncate(safeActor, 80), truncate(action, 80), truncate(target, 160), truncate(details, 2000)));
        } catch (Exception ex) {
            log.warn("Failed to save async audit log [{} / {}]: {}", action, actor, ex.getMessage());
        }
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
