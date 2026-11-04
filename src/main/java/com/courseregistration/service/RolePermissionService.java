package com.courseregistration.service;

import com.courseregistration.dto.RolePermissionsDto;
import com.courseregistration.entity.RolePermission;
import com.courseregistration.entity.UserAccount;
import com.courseregistration.repository.RolePermissionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class RolePermissionService {
    private static final Map<String, RolePermissionsDto.PermissionDto> CATALOG = new LinkedHashMap<>();
    private static final Map<UserAccount.Role, String> ROLE_LABELS = Map.of(
            UserAccount.Role.STUDENT, "Sinh viên", UserAccount.Role.LECTURER, "Giảng viên",
            UserAccount.Role.TRAINING_OFFICE, "Ban Đào tạo", UserAccount.Role.ADMIN, "Quản trị viên");
    static {
        add("STUDENT_ACADEMIC", "Nghiệp vụ sinh viên", "Tra cứu học phần, đăng ký, lịch sử và chương trình đào tạo.");
        add("LECTURER_WORKSPACE", "Không gian giảng viên", "Xem lịch giảng dạy và danh sách lớp được phân công.");
        add("TRAINING_READ", "Tra cứu học vụ", "Xem dữ liệu môn học, lớp, học kỳ và chương trình.");
        add("TRAINING_MANAGE", "Quản lý học vụ", "Tạo và cập nhật môn, lớp, học kỳ, đợt đăng ký, chương trình và tiên quyết.");
        add("REPORTS_VIEW", "Báo cáo", "Xem và xuất thống kê đăng ký học phần.");
        add("ACCOUNTS_MANAGE", "Quản lý tài khoản", "Tạo, sửa, khóa và vô hiệu hóa tài khoản.");
        add("AUDIT_VIEW", "Nhật ký hệ thống", "Tra cứu và xuất nhật ký hoạt động.");
        add("PERMISSIONS_MANAGE", "Quản lý phân quyền", "Cấu hình quyền nghiệp vụ của từng vai trò.");
    }
    private static void add(String key, String label, String description) { CATALOG.put(key, new RolePermissionsDto.PermissionDto(key, label, description)); }

    private final RolePermissionRepository permissions;
    private final AuditService audit;
    public RolePermissionService(RolePermissionRepository permissions, AuditService audit) { this.permissions = permissions; this.audit = audit; }

    @Transactional(readOnly = true)
    public List<RolePermissionsDto> list() {
        return Arrays.stream(UserAccount.Role.values()).map(role -> new RolePermissionsDto(role.name(), ROLE_LABELS.get(role),
                List.copyOf(CATALOG.values()), permissions.findAllByRoleOrderByPermissionAsc(role).stream().map(RolePermission::getPermission).toList())).toList();
    }

    @Transactional
    public RolePermissionsDto update(UserAccount.Role role, Set<String> requested) {
        if (requested == null || requested.stream().anyMatch(key -> !CATALOG.containsKey(key)))
            throw new IllegalArgumentException("Danh sách quyền chứa giá trị không hợp lệ.");
        Set<String> next = new HashSet<>(requested);
        if (role == UserAccount.Role.ADMIN) {
            next.add("PERMISSIONS_MANAGE");
            next.add("ACCOUNTS_MANAGE");
        }
        permissions.deleteAllByRole(role);
        permissions.saveAll(next.stream().sorted().map(key -> new RolePermission(role, key)).toList());
        audit.record("ROLE_PERMISSIONS_UPDATED", role.name(), "Cập nhật quyền: " + String.join(",", next));
        return list().stream().filter(item -> item.role().equals(role.name())).findFirst().orElseThrow();
    }

    @Transactional
    public void initializeDefaults() {
        if (permissions.count() > 0) return;
        Map<UserAccount.Role, Set<String>> defaults = Map.of(
                UserAccount.Role.STUDENT, Set.of("STUDENT_ACADEMIC"),
                UserAccount.Role.LECTURER, Set.of("LECTURER_WORKSPACE", "TRAINING_READ"),
                UserAccount.Role.TRAINING_OFFICE, Set.of("TRAINING_READ", "TRAINING_MANAGE", "REPORTS_VIEW"),
                UserAccount.Role.ADMIN, Set.copyOf(CATALOG.keySet()));
        defaults.forEach((role, keys) -> permissions.saveAll(keys.stream().map(key -> new RolePermission(role, key)).toList()));
    }
}
