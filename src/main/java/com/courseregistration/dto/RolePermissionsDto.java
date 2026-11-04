package com.courseregistration.dto;

import java.util.List;

public record RolePermissionsDto(String role, String roleLabel, List<PermissionDto> permissions, List<String> granted) {
    public record PermissionDto(String key, String label, String description) {}
}
