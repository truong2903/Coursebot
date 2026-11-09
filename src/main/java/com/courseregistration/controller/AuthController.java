package com.courseregistration.controller;

import com.courseregistration.dto.*;
import com.courseregistration.entity.UserAccount;
import com.courseregistration.entity.RolePermission;
import com.courseregistration.repository.UserAccountRepository;
import com.courseregistration.repository.SemesterRepository;
import com.courseregistration.repository.RolePermissionRepository;
import com.courseregistration.repository.StudentRepository;
import com.courseregistration.repository.LecturerRepository;
import com.courseregistration.service.CourseService;
import com.courseregistration.service.PasswordResetService;
import com.courseregistration.service.AuditService;
import com.courseregistration.service.AuthService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final AuthenticationManager authenticationManager;
    private final UserAccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final SemesterRepository semesterRepository;
    private final PasswordResetService passwordResetService;
    private final AuditService audit;
    private final RolePermissionRepository rolePermissions;
    private final StudentRepository studentRepository;
    private final LecturerRepository lecturerRepository;

    private final java.util.Map<UserAccount.Role, java.util.List<String>> permissionCache = new java.util.concurrent.ConcurrentHashMap<>();
    private volatile String cachedSemesterName = null;
    private volatile long semesterCacheTimestamp = 0;

    public AuthController(AuthService authService, AuthenticationManager authenticationManager,
                          UserAccountRepository accountRepository, PasswordEncoder passwordEncoder,
                          SemesterRepository semesterRepository, PasswordResetService passwordResetService,
                          AuditService audit, RolePermissionRepository rolePermissions,
                          StudentRepository studentRepository, LecturerRepository lecturerRepository) {
        this.authService = authService;
        this.authenticationManager = authenticationManager;
        this.accountRepository = accountRepository;
        this.passwordEncoder = passwordEncoder;
        this.semesterRepository = semesterRepository;
        this.passwordResetService = passwordResetService;
        this.audit = audit;
        this.rolePermissions = rolePermissions;
        this.studentRepository = studentRepository;
        this.lecturerRepository = lecturerRepository;
    }

    @PostMapping("/login")
    public AccountSessionDto login(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest) {
        var authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username().trim(), request.password()));
        HttpSession previousSession = servletRequest.getSession(false);
        if (previousSession != null) servletRequest.changeSessionId();
        SecurityContextHolder.getContext().setAuthentication(authentication);
        HttpSession session = servletRequest.getSession(true);
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, SecurityContextHolder.getContext());
        UserAccount account = accountRepository.findByUsernameIgnoreCase(authentication.getName())
                .orElseThrow(() -> new IllegalStateException("Không tìm thấy tài khoản."));

        if (account.getPasswordHash() != null && account.getPasswordHash().startsWith("$2a$12$")) {
            account.setPasswordHash(passwordEncoder.encode(request.password()));
            accountRepository.save(account);
        }

        audit.recordAsync(account.getUsername(), "LOGIN_SUCCESS", account.getUsername(), "Đăng nhập thành công");
        return accountDto(account);
    }

    @GetMapping("/me")
    public AccountSessionDto currentAccount() {
        return accountDto(authService.currentAccount());
    }

    @PostMapping("/logout")
    public ActionResponse logout(HttpServletRequest request) {
        String actor=SecurityContextHolder.getContext().getAuthentication()==null?"unknown":SecurityContextHolder.getContext().getAuthentication().getName();
        audit.record("LOGOUT",actor,"Đăng xuất");
        SecurityContextHolder.clearContext();
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        return new ActionResponse(true, "Bạn đã đăng xuất.");
    }

    @PostMapping("/change-password")
    public ActionResponse changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        UserAccount account = authService.currentAccount();
        if (!passwordEncoder.matches(request.currentPassword(), account.getPasswordHash()))
            throw new IllegalArgumentException("Mật khẩu hiện tại không chính xác.");
        if (passwordEncoder.matches(request.newPassword(), account.getPasswordHash()))
            throw new IllegalArgumentException("Mật khẩu mới phải khác mật khẩu hiện tại.");
        account.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        accountRepository.save(account);
        audit.record("PASSWORD_CHANGED",account.getUsername(),"Đổi mật khẩu");
        return new ActionResponse(true, "Đổi mật khẩu thành công.");
    }

    @PostMapping("/forgot-password")
    public ActionResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.requestReset(request.email());
        return new ActionResponse(true,"Nếu email thuộc một tài khoản đang hoạt động, hướng dẫn khôi phục sẽ được gửi đến email đó.");
    }

    @PostMapping("/reset-password")
    public ActionResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.reset(request.email(),request.token(),request.newPassword());
        audit.record("PASSWORD_RESET","account","Đặt lại mật khẩu qua email");
        return new ActionResponse(true,"Mật khẩu đã được đặt lại. Bạn có thể đăng nhập bằng mật khẩu mới.");
    }

    private java.util.List<String> permissionsFor(UserAccount.Role role) {
        return permissionCache.computeIfAbsent(role, r ->
            rolePermissions.findAllByRoleOrderByPermissionAsc(r).stream()
                    .map(RolePermission::getPermission)
                    .toList()
        );
    }

    private AccountSessionDto accountDto(UserAccount account) {
        var permissions = permissionsFor(account.getRole());
        return switch (account.getRole()) {
            case STUDENT -> {
                String fullName = account.getUsername();
                String code = account.getStudentCode();
                if (code != null) {
                    var studentOpt = studentRepository.findByStudentCode(code);
                    if (studentOpt.isPresent()) {
                        fullName = studentOpt.get().getFullName();
                    }
                }
                yield AccountSessionDto.from(account, fullName, code == null ? account.getUsername() : code, semesterName(), permissions);
            }
            case LECTURER -> {
                String fullName = account.getUsername();
                String code = account.getLecturerCode();
                if (code != null) {
                    var lecturerOpt = lecturerRepository.findByLecturerCode(code);
                    if (lecturerOpt.isPresent()) {
                        fullName = lecturerOpt.get().getFullName();
                    }
                }
                yield AccountSessionDto.from(account, fullName, code == null ? account.getUsername() : code, semesterName(), permissions);
            }
            case TRAINING_OFFICE -> AccountSessionDto.from(account, account.getUsername(), account.getUsername(), semesterName(), permissions);
            case ADMIN -> AccountSessionDto.from(account, account.getUsername(), account.getUsername(), semesterName(), permissions);
        };
    }

    private String semesterName() {
        long now = System.currentTimeMillis();
        if (cachedSemesterName != null && (now - semesterCacheTimestamp) < 60_000) {
            return cachedSemesterName;
        }
        var today = java.time.LocalDate.now();
        String name = semesterRepository.findFirstByRegistrationAlwaysOpenTrueAndStatusOrderByCodeDesc(com.courseregistration.entity.Semester.Status.ACTIVE)
                .or(() -> semesterRepository.findFirstByRegistrationOpenAtLessThanEqualAndRegistrationCloseAtGreaterThanEqual(today, today))
                .or(() -> semesterRepository.findFirstByStatusOrderByStartsAtDesc(com.courseregistration.entity.Semester.Status.ACTIVE))
                .or(() -> semesterRepository.findAllByOrderByStartsAtDesc().stream().findFirst())
                .map(s -> s.getName()).orElse("");
        cachedSemesterName = name;
        semesterCacheTimestamp = now;
        return name;
    }
}
