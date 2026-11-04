package com.courseregistration.repository;

import com.courseregistration.entity.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    Optional<UserAccount> findByUsernameIgnoreCase(String username);
    Optional<UserAccount> findByStudentCode(String studentCode);
    Optional<UserAccount> findByLecturerCode(String lecturerCode);
    Optional<UserAccount> findFirstByEmailIgnoreCase(String email);
    boolean existsByUsernameIgnoreCase(String username);
    boolean existsByEmailIgnoreCase(String email);
    long countByRole(UserAccount.Role role);
    long countByRoleAndStatus(UserAccount.Role role,UserAccount.Status status);
}
