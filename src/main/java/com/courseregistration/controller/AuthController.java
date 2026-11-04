package com.courseregistration.controller;

import com.courseregistration.dto.*;
import com.courseregistration.entity.UserAccount;
import com.courseregistration.repository.UserAccountRepository;
import com.courseregistration.repository.SemesterRepository;
import com.courseregistration.repository.RolePermissionRepository;
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
    public AuthController(AuthService authService, AuthenticationManager authenticationManager,
                          UserAccountRepository accountRepository, PasswordEncoder passwordEncoder,
                          SemesterRepository semesterRepository, PasswordResetService passwordResetService,AuditService audit,
                          RolePermissionRepository rolePermissions) {
        this.authService = authService;
        this.authenticationManager = authenticationManager;
        this.accountRepository = accountRepository;
        this.passwordEncoder = passwordEncoder;
        this.semesterRepository = semesterRepository;
        this.passwordResetService = passwordResetService;
        this.audit=audit;
        this.rolePermissions=rolePermissions;
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
        audit.record("LOGIN_SUCCESS",account.getUsername(),"Đăng nhập thành công");
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

    private AccountSessionDto accountDto(UserAccount account) {
        var permissions=rolePermissions.findAllByRoleOrderByPermissionAsc(account.getRole()).stream().map(item->item.getPermission()).toList();
        return switch (account.getRole()) {
            case STUDENT -> {
                var student = authService.currentStudent();
                yield AccountSessionDto.from(account, student.getFullName(), student.getStudentCode(), semesterName(), permissions);
            }
            case LECTURER -> {
                var lecturer = authService.currentLecturer();
                yield AccountSessionDto.from(account, lecturer.getFullName(), lecturer.getLecturerCode(), semesterName(), permissions);
            }
            case TRAINING_OFFICE -> AccountSessionDto.from(account, account.getUsername(), account.getUsername(), semesterName(), permissions);
            case ADMIN -> AccountSessionDto.from(account, account.getUsername(), account.getUsername(), semesterName(), permissions);
        };
    }

    private String semesterName() {
        var today = java.time.LocalDate.now();
        return semesterRepository.findFirstByRegistrationAlwaysOpenTrueAndStatusOrderByCodeDesc(com.courseregistration.entity.Semester.Status.ACTIVE)
                .or(() -> semesterRepository.findFirstByRegistrationOpenAtLessThanEqualAndRegistrationCloseAtGreaterThanEqual(today, today))
                .or(() -> semesterRepository.findFirstByStatusOrderByStartsAtDesc(com.courseregistration.entity.Semester.Status.ACTIVE))
                .or(() -> semesterRepository.findAllByOrderByStartsAtDesc().stream().findFirst())
                .map(s -> s.getName()).orElse("");
    }
}
