package com.courseregistration;

import com.courseregistration.repository.SemesterRepository;
import com.courseregistration.service.CourseService;
import com.courseregistration.service.TimetableImportService;
import com.courseregistration.service.TrainingManagementService;
import com.courseregistration.dto.RegistrationPeriodRequest;
import com.courseregistration.entity.RegistrationPeriod;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.nio.file.Path;
import java.time.LocalDateTime;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:import-tests;DB_CLOSE_DELAY=-1",
        "app.preview.accounts-enabled=false","app.timetable.source-url=",
        "app.bootstrap.admin-password=IntegrationTest2026!"})
class TimetableImportIntegrationTest {
    @Autowired TimetableImportService importer;
    @Autowired JdbcTemplate target;
    @Autowired SemesterRepository semesters;
    @Autowired CourseService courses;
    @Autowired TrainingManagementService training;
    @TempDir Path temp;
    String url;
    JdbcTemplate source;
    @BeforeEach void setup(){
        for(String table:new String[]{"section_meetings","course_sections","courses","registration_periods","semesters","timetable_app_imports"})target.execute("DELETE FROM "+table);
        url="jdbc:h2:file:"+temp.resolve("source").toString().replace('\\','/');
        source=new JdbcTemplate(new DriverManagerDataSource(url,"sa",""));
        source.execute("""
            CREATE TABLE timetable_imports(id INT,sha256 VARCHAR);
            INSERT INTO timetable_imports VALUES(1,'fixture-sha256');
            CREATE TABLE timetable_semesters(code VARCHAR);
            INSERT INTO timetable_semesters VALUES('20261');
            CREATE TABLE timetable_courses(code VARCHAR,name VARCHAR,department_code VARCHAR,credits INT,english_name VARCHAR,workload VARCHAR);
            INSERT INTO timetable_courses VALUES('TEST101','Môn kiểm tra','CNTT',3,'Test course','3(3-0-0-6)');
            CREATE TABLE timetable_sections(id VARCHAR,section_code VARCHAR,course_code VARCHAR,semester_code VARCHAR,capacity INT,enrolled_snapshot INT,source_status VARCHAR,section_type VARCHAR);
            INSERT INTO timetable_sections VALUES('20261:ONE','ONE','TEST101','20261',20,12,'Đăng ký','LT');
            CREATE TABLE timetable_section_links(section_id VARCHAR,linked_section_id VARCHAR);
            CREATE TABLE timetable_source_rows(id INT,row_number INT);
            INSERT INTO timetable_source_rows VALUES(1,4),(2,5);
            CREATE TABLE timetable_meetings(id INT,section_id VARCHAR,source_row_id INT,day_of_week INT,starts_at TIME,ends_at TIME,room_code VARCHAR,weeks_raw VARCHAR,time_raw VARCHAR);
            INSERT INTO timetable_meetings VALUES(1,'20261:ONE',1,1,'09:00','11:00','D9','2-9','0900-1100'),(2,'20261:ONE',2,3,'13:00','15:00','D8','11-18','1300-1500');
            CREATE TABLE timetable_import_issues(source_row_id INT,issue_code VARCHAR);
            """);
    }
    @Test void importsMultipleMeetingsAndKeepsManualChangesWhenRerun(){
        importer.importSource(url,true);
        assertEquals(2,target.queryForObject("SELECT COUNT(*) FROM section_meetings",Integer.class));
        assertNull(target.queryForObject("SELECT lecturer_id FROM course_sections WHERE id='20261:ONE'",Long.class));
        var semester=semesters.findByCode("20261").orElseThrow();
        assertNull(semester.getStartsAt());assertTrue(courses.registrationOpen(semester));
        target.update("UPDATE semesters SET registration_always_open=FALSE");
        target.update("UPDATE courses SET name='Tên đã chỉnh sửa'");
        assertTrue(importer.importSource(url,true).contains("đã được nhập"));
        assertEquals(2,target.queryForObject("SELECT COUNT(*) FROM section_meetings",Integer.class));
        assertEquals("Tên đã chỉnh sửa",target.queryForObject("SELECT name FROM courses",String.class));
        assertFalse(courses.registrationOpen(semesters.findByCode("20261").orElseThrow()));
    }
    @Test void aCollisionRollsBackTheWholeImport(){
        importer.importSource(url,true);
        target.update("DELETE FROM timetable_app_imports");
        source.update("INSERT INTO timetable_courses VALUES('TEST102','Môn mới','CNTT',2,'New course','2(2-0-0-4)')");
        assertThrows(IllegalStateException.class,()->importer.importSource(url,true));
        assertEquals(0,target.queryForObject("SELECT COUNT(*) FROM courses WHERE code='TEST102'",Integer.class));
        assertEquals(1,target.queryForObject("SELECT COUNT(*) FROM course_sections",Integer.class));
        assertEquals(0,target.queryForObject("SELECT COUNT(*) FROM timetable_app_imports",Integer.class));
    }
    @Test void anOfficialRegistrationPeriodReplacesContinuousOpening(){
        importer.importSource(url,true);
        var start=LocalDateTime.now().plusDays(1).withNano(0);
        var end=start.plusDays(2);
        training.createPeriod(new RegistrationPeriodRequest("20261",start,end,RegistrationPeriod.Status.SCHEDULED));
        var semester=semesters.findByCode("20261").orElseThrow();
        assertFalse(semester.isRegistrationAlwaysOpen());assertFalse(courses.registrationOpen(semester));
        assertEquals(start,target.queryForObject("SELECT starts_at FROM registration_periods",LocalDateTime.class));
        assertNull(semester.getStartsAt());
    }
}
