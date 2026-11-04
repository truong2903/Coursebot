package com.courseregistration.repository;

import com.courseregistration.entity.CourseCondition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;
import java.util.Set;

public interface CourseConditionRepository extends JpaRepository<CourseCondition, Long> {
    record RuleView(String courseCode, String requiredCourseCode, String conditionType) {
        public boolean isSatisfiedBy(Set<String> completedCodes, Set<String> priorStudiedCodes, Set<String> concurrentCodes) {
            return CourseCondition.evaluate(conditionType, requiredCourseCode, completedCodes, priorStudiedCodes, concurrentCodes);
        }
    }

    @Query("select r from CourseCondition r join fetch r.course c join fetch r.conditionCourse req "
            + "where upper(c.code) = upper(:courseCode) order by r.id asc")
    List<CourseCondition> findAllByCourseCode(@Param("courseCode") String courseCode);

    @Query("select new com.courseregistration.repository.CourseConditionRepository$RuleView(c.code, req.code, r.conditionType) "
            + "from CourseCondition r join r.course c join r.conditionCourse req "
            + "where upper(c.code) = upper(:courseCode) order by r.id asc")
    List<RuleView> findRuleViewsByCourseCode(@Param("courseCode") String courseCode);

    @Query("select new com.courseregistration.repository.CourseConditionRepository$RuleView(c.code, req.code, r.conditionType) "
            + "from CourseCondition r join r.course c join r.conditionCourse req")
    List<RuleView> findAllRuleViews();

    @Query("select new com.courseregistration.repository.CourseConditionRepository$RuleView(c.code, req.code, r.conditionType) "
            + "from CourseCondition r join r.course c join r.conditionCourse req "
            + "where upper(req.code) = upper(:requiredCourseCode) "
            + "and r.conditionType = com.courseregistration.entity.CourseCondition.TYPE_COREQUISITE "
            + "and c.code in :activeCourseCodes order by c.code asc")
    List<RuleView> findCorequisiteDependents(@Param("requiredCourseCode") String requiredCourseCode,
                                             @Param("activeCourseCodes") Collection<String> activeCourseCodes);
}
