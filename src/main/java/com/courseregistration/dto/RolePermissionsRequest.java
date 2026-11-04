package com.courseregistration.dto;

import jakarta.validation.constraints.NotNull;
import java.util.Set;

public record RolePermissionsRequest(@NotNull Set<String> permissions) {}
