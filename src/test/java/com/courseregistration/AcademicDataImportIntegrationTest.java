package com.courseregistration;

import com.courseregistration.service.AcademicDataImportService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.nio.file.Path;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:academic-import-tests;DB_CLOSE_DELAY=-1","app.academic.source-url=","app.timetable.source-url=","app.preview.accounts-enabled=false"})
class AcademicDataImportIntegrationTest {
    @TempDir Path directory;
    @Autowired AcademicDataImportService importer;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    String sourceUrl;

    @BeforeEach void prepare() throws Exception {
        jdbc.execute("SET REFERENTIAL_INTEGRITY FALSE");
        for(String table:List.of("academic_data_imports","academic_results","course_conditions","student_completed_courses","enrollments","section_meetings","course_sections","registration_periods","curriculum_courses","curricula","course_prerequisites","students","lecturers","courses","semesters","administrative_classes","academic_programs","departments","teaching_periods","user_accounts"))jdbc.update("DELETE FROM "+table);
        jdbc.execute("SET REFERENTIAL_INTEGRITY TRUE");
        sourceUrl="jdbc:h2:file:"+directory.resolve("source").toString().replace('\\','/');
        try(var connection=new DriverManagerDataSource(sourceUrl,"sa","").getConnection()) {
            ScriptUtils.executeSqlScript(connection,new ClassPathResource("academic-source.sql"));
        }
    }
    @Test void importsProfilesRetakesPeriodsAndPendingWithoutDoubleCounting() {
        importer.importSource(sourceUrl,"TestAcademic2026!");
        assertEquals("0123456789",jdbc.queryForObject("SELECT phone FROM students",String.class));
        assertEquals("IT24A",jdbc.queryForObject("SELECT administrative_class_code FROM students",String.class));
        assertEquals("Tiến sĩ",jdbc.queryForObject("SELECT academic_degree FROM lecturers",String.class));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM academic_results",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM student_completed_courses",Integer.class));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM course_conditions",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM course_prerequisites",Integer.class));
        assertEquals("PENDING",jdbc.queryForObject("SELECT status FROM enrollments",String.class));
        assertEquals(0,jdbc.queryForObject("SELECT imported_enrolled FROM course_sections",Integer.class));
        assertEquals("08:45:00",jdbc.queryForObject("SELECT ends_at FROM section_meetings",String.class));
        assertEquals("Mẫu – chờ nhà trường xác nhận",jdbc.queryForObject("SELECT time_source_status FROM section_meetings",String.class));
        assertTrue(jdbc.queryForObject("SELECT enrollment_date_only FROM enrollments",Boolean.class));
        assertTrue(encoder.matches("TestAcademic2026!",jdbc.queryForObject("SELECT password_hash FROM user_accounts WHERE username='student@example.test'",String.class)));
        jdbc.update("UPDATE students SET phone='0000000000'");
        jdbc.update("UPDATE user_accounts SET password_hash='edited' WHERE username='student@example.test'");
        importer.importSource(sourceUrl,"DifferentPassword2026!");
        assertEquals("0000000000",jdbc.queryForObject("SELECT phone FROM students",String.class));
        assertEquals("edited",jdbc.queryForObject("SELECT password_hash FROM user_accounts WHERE username='student@example.test'",String.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM academic_data_imports",Integer.class));
    }
    @Test void lateAccountCollisionRollsBackEntireImport() {
        jdbc.update("INSERT INTO user_accounts(username,password_hash,role,status,created_at,updated_at) VALUES('academic_training','existing','TRAINING_OFFICE','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
        assertThrows(IllegalStateException.class,()->importer.importSource(sourceUrl,"TestAcademic2026!"));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM students",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM departments",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM enrollments",Integer.class));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM academic_data_imports",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM user_accounts",Integer.class));
    }
}
