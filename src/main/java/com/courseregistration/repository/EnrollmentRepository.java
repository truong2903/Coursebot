package com.courseregistration.repository;

import com.courseregistration.entity.CourseSection;
import com.courseregistration.entity.Enrollment;
import com.courseregistration.entity.Enrollment.Status;
import com.courseregistration.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {
    @Query("select e.section.id, count(e) from Enrollment e where e.status = com.courseregistration.entity.Enrollment.Status.ENROLLED group by e.section.id")
    List<Object[]> activeCountsBySection();

    List<Enrollment> findAllByStudentOrderByEnrolledAtDesc(Student student);
    List<Enrollment> findAllByStudentAndSection_Semester_CodeAndStatusOrderByEnrolledAtAsc(Student student, String semesterCode, Status status);
    Optional<Enrollment> findByStudentAndSection(Student student, CourseSection section);
    Optional<Enrollment> findByStudentAndSectionAndStatus(Student student, CourseSection section, Status status);
    List<Enrollment> findAllBySectionAndStatusOrderByEnrolledAtAsc(CourseSection section, Status status);
    long countBySection_IdAndStatus(String sectionId, Status status);
    long countByStatus(Status status);
    boolean existsByStudentAndSectionAndStatus(Student student, CourseSection section, Status status);

    @Query("select e from Enrollment e "
            + "join fetch e.student st "
            + "join fetch e.section sec "
            + "join fetch sec.course c "
            + "join fetch sec.semester sem "
            + "order by case when e.status = com.courseregistration.entity.Enrollment.Status.PENDING then 0 "
            + "when e.status = com.courseregistration.entity.Enrollment.Status.ENROLLED then 1 else 2 end asc, "
            + "e.enrolledAt desc, e.id desc")
    List<Enrollment> findAllForManagement();

    @Query("select e from Enrollment e "
            + "join fetch e.student st "
            + "join fetch e.section sec "
            + "join fetch sec.course c "
            + "join fetch sec.semester sem "
            + "where e.id = :id")
    Optional<Enrollment> findByIdWithDetails(@Param("id") Long id);
}
