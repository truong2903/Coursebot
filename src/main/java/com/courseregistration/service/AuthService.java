package com.courseregistration.service;

import com.courseregistration.entity.Student;
import com.courseregistration.entity.Lecturer;
import com.courseregistration.entity.UserAccount;
import com.courseregistration.repository.LecturerRepository;
import com.courseregistration.repository.StudentRepository;
import com.courseregistration.repository.UserAccountRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final StudentRepository studentRepository;
    private final LecturerRepository lecturerRepository;
    private final UserAccountRepository accountRepository;
    public AuthService(StudentRepository studentRepository, LecturerRepository lecturerRepository, UserAccountRepository accountRepository) {
        this.studentRepository = studentRepository;
        this.lecturerRepository = lecturerRepository;
        this.accountRepository = accountRepository;
    }

    @Transactional(readOnly = true)
    public UserAccount currentAccount() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getPrincipal()))
            throw new IllegalStateException("Vui lòng đăng nhập để tiếp tục.");
        UserAccount account=accountRepository.findByUsernameIgnoreCase(authentication.getName())
                .orElseThrow(() -> new IllegalStateException("Không tìm thấy tài khoản hiện tại."));
        if(account.getStatus()!=UserAccount.Status.ACTIVE)throw new IllegalStateException("Tài khoản hiện đã bị khóa hoặc vô hiệu hóa.");
        return account;
    }

    @Transactional(readOnly = true)
    public Student currentStudent() {
        UserAccount account = currentAccount();
        if (account.getRole() != UserAccount.Role.STUDENT || account.getStudentCode() == null)
            throw new IllegalStateException("Tài khoản hiện tại không phải tài khoản sinh viên.");
        return studentRepository.findByStudentCode(account.getStudentCode())
                .orElseThrow(() -> new IllegalStateException("Hồ sơ sinh viên của tài khoản chưa được thiết lập."));
    }

    @Transactional(readOnly = true)
    public Lecturer currentLecturer() {
        UserAccount account = currentAccount();
        if (account.getRole() != UserAccount.Role.LECTURER || account.getLecturerCode() == null)
            throw new IllegalStateException("Tài khoản hiện tại không phải tài khoản giảng viên.");
        return lecturerRepository.findByLecturerCode(account.getLecturerCode())
                .orElseThrow(() -> new IllegalStateException("Hồ sơ giảng viên của tài khoản chưa được thiết lập."));
    }
}
