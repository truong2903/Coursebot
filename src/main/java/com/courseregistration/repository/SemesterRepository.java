package com.courseregistration.repository;

import com.courseregistration.entity.Semester;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.List;

public interface SemesterRepository extends JpaRepository<Semester, Long> {
    Optional<Semester> findByCode(String code);
    Optional<Semester> findByCodeIgnoreCase(String code);
    boolean existsByCodeIgnoreCase(String code);
    @Query("select s from Semester s order by case when s.startsAt is null then 1 else 0 end asc, s.startsAt desc, s.code desc")
    List<Semester> findAllByOrderByStartsAtDesc();
    @Query("select s from Semester s where s.status = :status order by case when s.startsAt is null then 1 else 0 end asc, s.startsAt desc, s.code desc limit 1")
    Optional<Semester> findFirstByStatusOrderByStartsAtDesc(@Param("status") Semester.Status status);
    Optional<Semester> findFirstByRegistrationAlwaysOpenTrueAndStatusOrderByCodeDesc(Semester.Status status);
    Optional<Semester> findFirstByRegistrationOpenAtLessThanEqualAndRegistrationCloseAtGreaterThanEqual(java.time.LocalDate openDate, java.time.LocalDate closeDate);
}
