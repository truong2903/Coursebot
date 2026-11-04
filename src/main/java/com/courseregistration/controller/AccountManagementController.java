package com.courseregistration.controller;

import com.courseregistration.dto.AccountManagementDto;
import com.courseregistration.dto.AccountManagementRequest;
import com.courseregistration.dto.ActionResponse;
import com.courseregistration.service.AccountManagementService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/accounts")
@PreAuthorize("@accessPolicy.has(authentication, 'ACCOUNTS_MANAGE')")
public class AccountManagementController {
    private final AccountManagementService service;
    public AccountManagementController(AccountManagementService service) { this.service = service; }

    @GetMapping public List<AccountManagementDto> list() { return service.list(); }
    @PostMapping public AccountManagementDto create(@Valid @RequestBody AccountManagementRequest request) { return service.create(request); }
    @PutMapping("/{id}") public AccountManagementDto update(@PathVariable Long id, @Valid @RequestBody AccountManagementRequest request) {
        return service.update(id, request);
    }
    @DeleteMapping("/{id}") public ActionResponse disable(@PathVariable Long id) {
        service.disable(id);
        return new ActionResponse(true,"Tài khoản đã được vô hiệu hóa; dữ liệu lịch sử được giữ lại.");
    }
}
