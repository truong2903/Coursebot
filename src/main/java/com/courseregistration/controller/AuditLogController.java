package com.courseregistration.controller;

import com.courseregistration.dto.AuditLogDto;
import com.courseregistration.repository.AuditLogRepository;
import com.courseregistration.repository.UserAccountRepository;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/audit-logs")
@PreAuthorize("@accessPolicy.has(authentication, 'AUDIT_VIEW')")
public class AuditLogController {
    private final AuditLogRepository logs;
    private final UserAccountRepository accounts;
    public AuditLogController(AuditLogRepository logs,UserAccountRepository accounts){this.logs=logs;this.accounts=accounts;}
    @GetMapping public List<AuditLogDto> list(@RequestParam(required=false) String actor,@RequestParam(required=false) String role,
            @RequestParam(required=false) String action,@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) LocalDateTime to){
        Map<String,String> roleByKey = new java.util.HashMap<>();
        for (var a : accounts.findAll()) {
            if (a.getUsername() != null) roleByKey.putIfAbsent(a.getUsername().toLowerCase(), a.getRole().name());
            if (a.getEmail() != null && !a.getEmail().isBlank()) roleByKey.putIfAbsent(a.getEmail().toLowerCase(), a.getRole().name());
        }
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"));
        return logs.findAll(sort).stream()
                .filter(item->actor==null||actor.isBlank()||item.getActor().toLowerCase().contains(actor.trim().toLowerCase()))
                .filter(item->action==null||action.isBlank()||item.getAction().equalsIgnoreCase(action.trim()))
                .filter(item->from==null||!item.getCreatedAt().isBefore(from))
                .filter(item->to==null||!item.getCreatedAt().isAfter(to))
                .filter(item->role==null||role.isBlank()||role.equalsIgnoreCase(roleByKey.getOrDefault(item.getActor().toLowerCase(),"SYSTEM")))
                .map(item->AuditLogDto.from(item,roleByKey.getOrDefault(item.getActor().toLowerCase(),"SYSTEM"))).toList();
    }
}
