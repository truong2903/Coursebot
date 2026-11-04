package com.courseregistration.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "role_permissions", uniqueConstraints = @UniqueConstraint(columnNames = {"role_name", "permission_key"}))
public class RolePermission {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Enumerated(EnumType.STRING) @Column(name = "role_name", nullable = false, length = 24)
    private UserAccount.Role role;
    @Column(name = "permission_key", nullable = false, length = 50)
    private String permission;

    protected RolePermission() {}
    public RolePermission(UserAccount.Role role, String permission) { this.role = role; this.permission = permission; }
    public Long getId() { return id; }
    public UserAccount.Role getRole() { return role; }
    public String getPermission() { return permission; }
}
