package com.courseregistration.repository;

import com.courseregistration.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken,Long>{
    Optional<PasswordResetToken> findByTokenHashAndUsedAtIsNull(String tokenHash);
    void deleteAllByAccount_Id(Long accountId);
    java.util.Optional<PasswordResetToken> findFirstByAccount_IdAndUsedAtIsNullOrderByIdDesc(Long accountId);
}
