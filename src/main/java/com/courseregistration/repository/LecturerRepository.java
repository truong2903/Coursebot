package com.courseregistration.repository;

import com.courseregistration.entity.Lecturer;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface LecturerRepository extends JpaRepository<Lecturer, Long> {
    Optional<Lecturer> findByLecturerCode(String lecturerCode);
}
