package com.courseregistration.repository;
import com.courseregistration.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface AuditLogRepository extends JpaRepository<AuditLog,Long>{
    List<AuditLog> findTop1000ByOrderByCreatedAtDesc();
}
