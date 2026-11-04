package com.courseregistration.repository;

import com.courseregistration.entity.AcademicProgram;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AcademicProgramRepository extends JpaRepository<AcademicProgram, String> {
    @Override
    @EntityGraph(attributePaths = {"department"})
    List<AcademicProgram> findAll();

    Optional<AcademicProgram> findFirstByNameIgnoreCase(String name);
}
