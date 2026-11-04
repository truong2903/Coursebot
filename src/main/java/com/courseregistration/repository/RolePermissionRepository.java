package com.courseregistration.repository;

import com.courseregistration.entity.RolePermission;
import com.courseregistration.entity.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RolePermissionRepository extends JpaRepository<RolePermission, Long> {
    boolean existsByRoleAndPermission(UserAccount.Role role, String permission);
    List<RolePermission> findAllByRoleOrderByPermissionAsc(UserAccount.Role role);
    void deleteAllByRole(UserAccount.Role role);
}
