package com.courseregistration.service;

import com.courseregistration.dto.AccountManagementDto;
import com.courseregistration.dto.AccountManagementRequest;
import com.courseregistration.entity.*;
import com.courseregistration.repository.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class AccountManagementService {
    private final UserAccountRepository accounts;
    private final StudentRepository students;
    private final LecturerRepository lecturers;
    private final PasswordEncoder encoder;
    private final AuditService audit;
    private final AuthService auth;

    public AccountManagementService(UserAccountRepository accounts, StudentRepository students,
                                    LecturerRepository lecturers, PasswordEncoder encoder,AuditService audit,AuthService auth) {
        this.accounts = accounts; this.students = students; this.lecturers = lecturers; this.encoder = encoder;this.audit=audit;this.auth=auth;
    }

    @Transactional(readOnly = true)
    public List<AccountManagementDto> list() {
        return accounts.findAll().stream().map(this::toDto).toList();
    }

    @Transactional
    public AccountManagementDto create(AccountManagementRequest request) {
        if (accounts.existsByUsernameIgnoreCase(request.username().trim())) throw new IllegalArgumentException("Tên đăng nhập đã tồn tại.");
        if (request.email() != null && !request.email().isBlank() && accounts.existsByEmailIgnoreCase(request.email().trim()))
            throw new IllegalArgumentException("Email này đã được gán cho tài khoản khác.");
        if (request.password() == null || request.password().length() < 10) throw new IllegalArgumentException("Mật khẩu phải có ít nhất 10 ký tự.");
        validateProfile(request);
        validateProfileOwnership(request,null);
        UserAccount account = new UserAccount(request.username().trim(), encoder.encode(request.password()), request.role(),
                clean(request.studentCode()), clean(request.lecturerCode()), clean(request.email()));
        account.setStatus(request.status() == null ? UserAccount.Status.ACTIVE : request.status());
        accounts.save(account);
        saveProfile(request);
        audit.record("ACCOUNT_CREATED",account.getUsername(),"Tạo tài khoản vai trò "+account.getRole().name());
        return toDto(account);
    }

    @Transactional
    public AccountManagementDto update(Long id, AccountManagementRequest request) {
        UserAccount account = accounts.findById(id).orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản."));
        boolean self=auth.currentAccount().getId().equals(account.getId());
        if(self&&(request.role()!=account.getRole()||request.status()!=null&&request.status()!=UserAccount.Status.ACTIVE))
            throw new IllegalArgumentException("Không thể tự đổi vai trò hoặc khóa tài khoản quản trị đang sử dụng.");
        if(account.getRole()==UserAccount.Role.ADMIN&&account.getStatus()==UserAccount.Status.ACTIVE&&
                (request.role()!=UserAccount.Role.ADMIN||request.status()==UserAccount.Status.DISABLED||request.status()==UserAccount.Status.LOCKED)&&
                accounts.countByRoleAndStatus(UserAccount.Role.ADMIN,UserAccount.Status.ACTIVE)<=1)
            throw new IllegalArgumentException("Không thể khóa hoặc đổi vai trò của quản trị viên đang hoạt động cuối cùng.");
        accounts.findByUsernameIgnoreCase(request.username().trim()).filter(other -> !other.getId().equals(id))
                .ifPresent(other -> { throw new IllegalArgumentException("Tên đăng nhập đã tồn tại."); });
        if (request.email() != null && !request.email().isBlank()) {
            accounts.findAll().stream().filter(other -> !other.getId().equals(id) && request.email().equalsIgnoreCase(other.getEmail()))
                    .findAny().ifPresent(other -> { throw new IllegalArgumentException("Email này đã được gán cho tài khoản khác."); });
        }
        validateProfile(request);
        validateProfileOwnership(request,id);
        account.setUsername(request.username().trim());
        account.setRole(request.role());
        account.setStudentCode(clean(request.studentCode()));
        account.setLecturerCode(clean(request.lecturerCode()));
        account.setEmail(clean(request.email()));
        if (request.status() != null) account.setStatus(request.status());
        if (request.password() != null && !request.password().isBlank()) {
            if (request.password().length() < 10) throw new IllegalArgumentException("Mật khẩu phải có ít nhất 10 ký tự.");
            account.setPasswordHash(encoder.encode(request.password()));
        }
        saveProfile(request);
        audit.record("ACCOUNT_UPDATED",account.getUsername(),"Cập nhật tài khoản và vai trò "+account.getRole().name());
        return toDto(account);
    }

    @Transactional
    public void disable(Long id) {
        UserAccount account = accounts.findById(id).orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản."));
        if(auth.currentAccount().getId().equals(account.getId()))throw new IllegalArgumentException("Không thể tự vô hiệu hóa tài khoản đang sử dụng.");
        if(account.getRole()==UserAccount.Role.ADMIN&&account.getStatus()==UserAccount.Status.ACTIVE&&accounts.countByRoleAndStatus(UserAccount.Role.ADMIN,UserAccount.Status.ACTIVE)<=1)
            throw new IllegalArgumentException("Không thể vô hiệu hóa quản trị viên đang hoạt động cuối cùng.");
        account.setStatus(UserAccount.Status.DISABLED);
        audit.record("ACCOUNT_DISABLED",account.getUsername(),"Vô hiệu hóa tài khoản");
    }

    private void validateProfile(AccountManagementRequest request) {
        if (request.role() == UserAccount.Role.STUDENT) {
            if (clean(request.studentCode()) == null || clean(request.displayName()) == null || clean(request.program()) == null || clean(request.cohort()) == null)
                throw new IllegalArgumentException("Tài khoản sinh viên cần mã sinh viên, họ tên, ngành học và khóa tuyển sinh.");
            if (clean(request.lecturerCode()) != null) throw new IllegalArgumentException("Tài khoản sinh viên không thể gắn mã giảng viên.");
        } else if (request.role() == UserAccount.Role.LECTURER) {
            if (clean(request.lecturerCode()) == null || clean(request.displayName()) == null || clean(request.department()) == null)
                throw new IllegalArgumentException("Tài khoản giảng viên cần mã giảng viên, họ tên và khoa.");
            if (clean(request.studentCode()) != null) throw new IllegalArgumentException("Tài khoản giảng viên không thể gắn mã sinh viên.");
        } else if (clean(request.studentCode()) != null || clean(request.lecturerCode()) != null) {
            throw new IllegalArgumentException("Chỉ tài khoản sinh viên hoặc giảng viên mới gắn với hồ sơ học vụ.");
        }
    }

    private void validateProfileOwnership(AccountManagementRequest request,Long accountId) {
        if(request.role()==UserAccount.Role.STUDENT&&clean(request.studentCode())!=null)
            accounts.findByStudentCode(request.studentCode().trim()).filter(existing->!existing.getId().equals(accountId))
                    .ifPresent(existing->{throw new IllegalArgumentException("Mã sinh viên đã được gán cho tài khoản khác.");});
        if(request.role()==UserAccount.Role.LECTURER&&clean(request.lecturerCode())!=null)
            accounts.findByLecturerCode(request.lecturerCode().trim()).filter(existing->!existing.getId().equals(accountId))
                    .ifPresent(existing->{throw new IllegalArgumentException("Mã giảng viên đã được gán cho tài khoản khác.");});
    }

    private void saveProfile(AccountManagementRequest request) {
        if (request.role() == UserAccount.Role.STUDENT) {
            Student student = students.findByStudentCode(request.studentCode().trim())
                    .orElseGet(() -> new Student(request.studentCode().trim(), request.displayName().trim(), request.program().trim(), clean(request.email())));
            student.updateProfile(request.displayName().trim(), request.program().trim(), clean(request.cohort()), clean(request.email()));
            students.save(student);
        } else if (request.role() == UserAccount.Role.LECTURER) {
            Lecturer lecturer = lecturers.findByLecturerCode(request.lecturerCode().trim())
                    .orElseGet(() -> new Lecturer(request.lecturerCode().trim(), request.displayName().trim(), request.department().trim()));
            lecturer.setFullName(request.displayName().trim()); lecturer.setDepartment(request.department().trim());
            lecturers.save(lecturer);
        }
    }

    private AccountManagementDto toDto(UserAccount account) {
        if (account.getRole() == UserAccount.Role.STUDENT && account.getStudentCode() != null) {
            return students.findByStudentCode(account.getStudentCode()).map(student ->
                    AccountManagementDto.from(account, student.getFullName(), student.getProgram(),student.getCohort(),null)).orElse(AccountManagementDto.from(account,null,null,null,null));
        }
        if (account.getRole() == UserAccount.Role.LECTURER && account.getLecturerCode() != null) {
            return lecturers.findByLecturerCode(account.getLecturerCode()).map(lecturer ->
                    AccountManagementDto.from(account, lecturer.getFullName(), null,null, lecturer.getDepartment())).orElse(AccountManagementDto.from(account,null,null,null,null));
        }
        return AccountManagementDto.from(account, null, null,null, null);
    }
    private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
