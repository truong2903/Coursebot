package com.courseregistration.security;

import com.courseregistration.entity.UserAccount;
import com.courseregistration.repository.RolePermissionRepository;
import com.courseregistration.repository.UserAccountRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component("accessPolicy")
public class AccessPolicyService {
    private final RolePermissionRepository permissions;
    private final UserAccountRepository accounts;
    public AccessPolicyService(RolePermissionRepository permissions, UserAccountRepository accounts) { this.permissions = permissions;this.accounts=accounts; }

    public boolean has(Authentication authentication, String permission) {
        if (authentication == null || !authentication.isAuthenticated()) return false;
        UserAccount account=accounts.findByUsernameIgnoreCase(authentication.getName()).orElse(null);
        if(account==null||account.getStatus()!=UserAccount.Status.ACTIVE)return false;
        UserAccount.Role role=account.getRole();
        return permissions.existsByRoleAndPermission(role, permission);
    }
}
