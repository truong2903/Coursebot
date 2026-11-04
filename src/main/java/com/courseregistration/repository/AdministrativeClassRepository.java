package com.courseregistration.repository;

import com.courseregistration.entity.AdministrativeClass;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AdministrativeClassRepository extends JpaRepository<AdministrativeClass, String> {
    @Override
    @EntityGraph(attributePaths = {"program", "program.department"})
    List<AdministrativeClass> findAll();
}
