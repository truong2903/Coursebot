package com.courseregistration.controller;

import com.courseregistration.dto.ActionResponse;
import com.courseregistration.dto.RolePermissionsDto;
import com.courseregistration.dto.RolePermissionsRequest;
import com.courseregistration.entity.UserAccount;
import com.courseregistration.service.RolePermissionService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/permissions")
@PreAuthorize("@accessPolicy.has(authentication, 'PERMISSIONS_MANAGE')")
public class RolePermissionController {
    private final RolePermissionService service;
    public RolePermissionController(RolePermissionService service) { this.service = service; }
    @GetMapping public List<RolePermissionsDto> list() { return service.list(); }
    @PutMapping("/{role}")
    public ActionResponse update(@PathVariable UserAccount.Role role, @Valid @RequestBody RolePermissionsRequest request) {
        service.update(role, request.permissions());
        return new ActionResponse(true, "Đã cập nhật quyền cho vai trò " + role.name() + ".");
    }
}
