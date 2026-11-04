package com.courseregistration.config;

import com.courseregistration.service.RolePermissionService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RolePermissionInitializer {
    @Bean CommandLineRunner initializeRolePermissions(RolePermissionService permissions) {
        return args -> permissions.initializeDefaults();
    }
}
