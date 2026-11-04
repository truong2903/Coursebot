package com.courseregistration.repository;
import com.courseregistration.entity.RegistrationPeriod;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
public interface RegistrationPeriodRepository extends JpaRepository<RegistrationPeriod,Long>{
    List<RegistrationPeriod> findAllByOrderByStartsAtDesc();
    Optional<RegistrationPeriod> findBySemester_Code(String code);
    boolean existsBySemester_Code(String code);
    Optional<RegistrationPeriod> findFirstByStatusAndStartsAtLessThanEqualAndEndsAtGreaterThanEqual(RegistrationPeriod.Status status,java.time.LocalDateTime start,java.time.LocalDateTime end);
    Optional<RegistrationPeriod> findFirstByStartsAtLessThanEqualAndEndsAtGreaterThanEqualAndStatusIn(java.time.LocalDateTime start,java.time.LocalDateTime end,java.util.Collection<RegistrationPeriod.Status> statuses);
}
