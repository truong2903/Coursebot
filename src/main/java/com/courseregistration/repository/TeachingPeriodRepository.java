package com.courseregistration.repository;

import com.courseregistration.entity.TeachingPeriod;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TeachingPeriodRepository extends JpaRepository<TeachingPeriod, Integer> {
    List<TeachingPeriod> findAllByOrderByCodeAsc();
}
