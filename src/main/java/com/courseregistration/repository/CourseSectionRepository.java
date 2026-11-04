package com.courseregistration.repository;

import com.courseregistration.entity.CourseSection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface CourseSectionRepository extends JpaRepository<CourseSection, String> {
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths={"course","semester","lecturer","meetings"})
    List<CourseSection> findAllBySemester_CodeOrderBySectionCode(String semesterCode);
    @Override
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths={"course","semester","lecturer","meetings"})
    List<CourseSection> findAll();
    boolean existsBySectionCodeIgnoreCaseAndSemester_Code(String sectionCode,String semesterCode);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from CourseSection s where s.id = :id")
    Optional<CourseSection> findByIdForUpdate(@Param("id") String id);
}
