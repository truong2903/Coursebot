package com.courseregistration.repository;
import com.courseregistration.entity.CurriculumCourse;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
public interface CurriculumCourseRepository extends JpaRepository<CurriculumCourse,Long>{
    @EntityGraph(attributePaths={"course","curriculum"})
    List<CurriculumCourse> findAllByCurriculum_CodeOrderBySuggestedSemesterAscOrderIndexAsc(String code);
    @EntityGraph(attributePaths={"course","curriculum"})
    List<CurriculumCourse> findAllByCurriculum_CodeOrderByOrderIndexAsc(String code);
    Optional<CurriculumCourse> findByCurriculum_CodeAndCourse_Code(String curriculum,String course);
    boolean existsByCurriculum_CodeAndCourse_Code(String curriculum,String course);
}
