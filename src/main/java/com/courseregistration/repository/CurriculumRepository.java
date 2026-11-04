package com.courseregistration.repository;
import com.courseregistration.entity.Curriculum;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface CurriculumRepository extends JpaRepository<Curriculum,Long>{
    Optional<Curriculum> findByCodeIgnoreCase(String code);
    boolean existsByCodeIgnoreCase(String code);
    java.util.List<Curriculum> findAllByProgramIgnoreCaseAndCohortIgnoreCaseAndStatusOrderByVersionDesc(String program,String cohort,Curriculum.Status status);
    java.util.List<Curriculum> findAllByStatusOrderByProgramAscCohortAscVersionDesc(Curriculum.Status status);
}
