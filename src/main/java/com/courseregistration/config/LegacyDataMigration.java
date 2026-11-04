package com.courseregistration.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.Map;

@Configuration
public class LegacyDataMigration {
    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    CommandLineRunner backfillNewAcademicFields(JdbcTemplate jdbc) {
        return args -> {
            jdbc.execute("ALTER TABLE course_sections ALTER COLUMN lecturer_id DROP NOT NULL");
            jdbc.update("UPDATE courses SET active = TRUE WHERE active IS NULL");
            jdbc.update("UPDATE course_sections SET status = 'OPEN' WHERE status IS NULL");
            jdbc.update("UPDATE semesters SET status = 'PLANNED' WHERE status IS NULL");
            jdbc.update("UPDATE semesters SET registration_always_open = FALSE WHERE registration_always_open IS NULL");
            jdbc.update("UPDATE course_sections SET schedule_review_required = FALSE WHERE schedule_review_required IS NULL");
            jdbc.query("SELECT id, starts_at FROM semesters WHERE ends_at IS NULL AND starts_at IS NOT NULL",
                    (rs, n) -> Map.entry(rs.getLong("id"), rs.getObject("starts_at", LocalDate.class)))
                    .forEach(entry -> jdbc.update("UPDATE semesters SET ends_at = ? WHERE id = ?",
                            entry.getValue().plusMonths(6), entry.getKey()));
        };
    }
}
