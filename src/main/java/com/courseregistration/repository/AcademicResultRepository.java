package com.courseregistration.repository;

import com.courseregistration.entity.AcademicResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface AcademicResultRepository extends JpaRepository<AcademicResult, Long> {
    @Query("select r from AcademicResult r join fetch r.course c join fetch r.semester se "
            + "where r.student.id = :studentId "
            + "order by case when se.startsAt is null then 1 else 0 end asc, se.startsAt desc, c.code asc")
    List<AcademicResult> findTranscriptByStudentId(@Param("studentId") Long studentId);
}
