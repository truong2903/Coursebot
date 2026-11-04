package com.courseregistration.repository;

import com.courseregistration.entity.CourseSection;
import com.courseregistration.entity.Student;
import com.courseregistration.entity.WaitlistEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface WaitlistRepository extends JpaRepository<WaitlistEntry, Long> {
    List<WaitlistEntry> findAllByStudentAndStatus(Student student, WaitlistEntry.Status status);
    @org.springframework.data.jpa.repository.Query("select w.section.id, count(w) from WaitlistEntry w where w.status = com.courseregistration.entity.WaitlistEntry.Status.WAITING group by w.section.id")
    List<Object[]> waitingCountsBySection();
    Optional<WaitlistEntry> findByStudentAndSection(Student student, CourseSection section);
    List<WaitlistEntry> findAllBySectionAndStatusOrderByCreatedAtAscIdAsc(CourseSection section, WaitlistEntry.Status status);
    long countByStatus(WaitlistEntry.Status status);
    long countBySection_IdAndStatus(String sectionId,WaitlistEntry.Status status);
    boolean existsByStudentAndSectionAndStatus(Student student, CourseSection section, WaitlistEntry.Status status);
}
