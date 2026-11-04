package com.courseregistration;

import com.courseregistration.dto.ChatRequest;
import com.courseregistration.repository.SemesterRepository;
import com.courseregistration.service.AcademicChatService;
import com.courseregistration.service.AcademicDataImportService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Verifies schema creation, legacy migration, academic import, lowercase JDBC column names,
 * and NULL ordering under PostgreSQL compatibility mode (DATABASE_TO_LOWER=TRUE, DEFAULT_NULL_ORDERING=HIGH).
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:pg-compat-tests;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
        "app.academic.source-url=",
        "app.timetable.source-url=",
        "app.preview.accounts-enabled=false",
        "app.ai.api-key="
})
class PostgreSqlCompatibilityTest {
    @TempDir
    Path directory;

    @Autowired
    AcademicDataImportService importer;

    @Autowired
    SemesterRepository semesters;

    @Autowired
    AcademicChatService chat;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    DataSourceProperties dataSourceProperties;

    String sourceUrl;

    @BeforeEach
    void prepare() throws Exception {
        for (String table : List.of(
                "academic_data_imports", "academic_results", "course_conditions", "student_completed_courses",
                "enrollments", "waitlist_entries", "section_meetings", "course_sections", "registration_periods",
                "curriculum_courses", "curricula", "course_prerequisites", "students", "lecturers", "courses",
                "semesters", "administrative_classes", "academic_programs", "departments", "teaching_periods",
                "password_reset_tokens", "user_accounts")) {
            jdbc.update("DELETE FROM " + table);
        }
        sourceUrl = "jdbc:h2:file:" + directory.resolve("pg-source").toString().replace('\\', '/');
        try (var connection = new DriverManagerDataSource(sourceUrl, "sa", "").getConnection()) {
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("academic-source.sql"));
        }
    }

    @Test
    void importsAcademicDatasetAndHandlesNullOrderingUnderPostgresRules() {
        String summary = importer.importSource(sourceUrl, "PostgresTest2026!");
        assertTrue(summary.contains("1 sinh viên"));
        assertEquals("{}", jdbc.queryForObject("SELECT manifest_json FROM academic_data_imports", String.class));

        // Insert a draft semester with NULL starts_at; NULLS LAST must keep dated semesters ahead of NULL ones.
        jdbc.update("INSERT INTO semesters(code, name, starts_at, status, registration_always_open) VALUES('DRAFT-NULL', 'Kỳ chưa có ngày', NULL, 'PLANNED', FALSE)");
        var ordered = semesters.findAllByOrderByStartsAtDesc();
        assertEquals("S2", ordered.getFirst().getCode());
        assertEquals("DRAFT-NULL", ordered.getLast().getCode());
    }
}
