package com.courseregistration.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/** Copies the validated source database once, without replacing existing application records. */
@Service
public class TimetableImportService {
    private final JdbcTemplate target;
    public TimetableImportService(JdbcTemplate target){this.target=target;}

    @Transactional
    public String importSource(String sourceUrl,boolean registrationAlwaysOpen){
        if(!sourceUrl.startsWith("jdbc:h2:file:"))throw new IllegalArgumentException("Nguồn thời khóa biểu phải là database H2 file cục bộ.");
        var dataSource=new DriverManagerDataSource(sourceUrl+";IFEXISTS=TRUE;ACCESS_MODE_DATA=r","sa","");
        var source=new JdbcTemplate(dataSource);
        String hash=source.queryForObject("SELECT sha256 FROM timetable_imports WHERE id=1",String.class);
        if(target.queryForObject("SELECT COUNT(*) FROM timetable_app_imports WHERE sha256=?",Integer.class,hash)>0)return "Dữ liệu thời khóa biểu đã được nhập; giữ nguyên các chỉnh sửa hiện tại.";
        var sourceSemesters=source.queryForList("SELECT code FROM timetable_semesters",String.class);
        for(String code:sourceSemesters){
            if(target.queryForObject("SELECT COUNT(*) FROM semesters WHERE code=?",Integer.class,code)==0)
                target.update("INSERT INTO semesters(code,name,status,registration_always_open) VALUES(?,?,?,?)",
                        code,"Học kỳ "+code,"ACTIVE",registrationAlwaysOpen);
        }
        var semesterIds=ids("semesters");
        var courseRows=source.queryForList("SELECT code,name,department_code,credits,english_name,workload FROM timetable_courses");
        var existingCourses=target.queryForList("SELECT code,name,credits FROM courses").stream().collect(Collectors.toMap(r->r.get("CODE").toString().toUpperCase(Locale.ROOT),r->r));
        List<Object[]> courses=new ArrayList<>();
        for(var row:courseRows){
            var existing=existingCourses.get(text(row,"CODE").toUpperCase(Locale.ROOT));
            if(existing!=null){
                if(!Objects.equals(existing.get("NAME"),row.get("NAME"))||((Number)existing.get("CREDITS")).intValue()!=((Number)row.get("CREDITS")).intValue())
                    throw new IllegalStateException("Môn "+row.get("CODE")+" đã tồn tại với tên hoặc tín chỉ khác. Cần đối chiếu trước khi nhập.");
                continue;
            }
            courses.add(new Object[]{row.get("CODE"),row.get("NAME"),row.get("DEPARTMENT_CODE"),row.get("CREDITS"),
                    "Chưa có dữ liệu tiên quyết","Tên tiếng Anh: "+row.get("ENGLISH_NAME")+". Khối lượng: "+row.get("WORKLOAD"),true});
        }
        batch("INSERT INTO courses(code,name,department,credits,prerequisite,description,active) VALUES(?,?,?,?,?,?,?)",courses);
        var courseIds=ids("courses");
        Set<String> review=source.queryForList("SELECT DISTINCT m.section_id FROM timetable_meetings m JOIN timetable_import_issues i ON i.source_row_id=m.source_row_id WHERE i.issue_code IN ('INVALID_TIME','MISSING_SCHEDULE','AMBIGUOUS_WEEKS')",String.class).stream().collect(Collectors.toSet());
        var sectionRows=source.queryForList("SELECT s.*,l.linked_section_id FROM timetable_sections s LEFT JOIN timetable_section_links l ON l.section_id=s.id ORDER BY s.id");
        Set<String> existingSections=new HashSet<>(target.queryForList("SELECT id FROM course_sections",String.class));
        List<Object[]> sections=new ArrayList<>();
        for(var row:sectionRows){
            String id=text(row,"ID");
            if(existingSections.contains(id))throw new IllegalStateException("Mã lớp "+id+" đã tồn tại. Không ghi đè dữ liệu lớp.");
            String status=switch(text(row,"SOURCE_STATUS")){
                case "Huỷ lớp","Hủy lớp" -> "CANCELLED";
                case "Đăng ký","Điều chỉnh ĐK" -> "OPEN";
                default -> "CLOSED";
            };
            String linked=text(row,"LINKED_SECTION_ID");
            sections.add(new Object[]{id,row.get("SECTION_CODE"),courseIds.get(text(row,"COURSE_CODE")),
                    semesterIds.get(text(row,"SEMESTER_CODE")),"Nhiều buổi học","Chưa có phòng",row.get("CAPACITY"),
                    "lavender",status,row.get("ENROLLED_SNAPSHOT"),row.get("SOURCE_STATUS"),row.get("SECTION_TYPE"),
                    linked==null?null:linked.substring(linked.indexOf(':')+1),hash,review.contains(id)});
        }
        batch("INSERT INTO course_sections(id,section_code,course_id,semester_id,schedule,room,capacity,color,status,imported_enrolled,source_status,section_type,linked_section_code,source_import_key,schedule_review_required) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",sections);
        var meetings=source.query("SELECT m.*,r.row_number FROM timetable_meetings m JOIN timetable_source_rows r ON r.id=m.source_row_id ORDER BY m.id",
                (rs,n)->new Object[]{rs.getString("section_id"),rs.getObject("day_of_week",Integer.class),rs.getObject("starts_at",java.time.LocalTime.class),rs.getObject("ends_at",java.time.LocalTime.class),
                        rs.getString("room_code"),rs.getString("weeks_raw"),rs.getString("time_raw"),rs.getInt("row_number")});
        batch("INSERT INTO section_meetings(section_id,day_of_week,starts_at,ends_at,room,weeks_expression,time_raw,source_row) VALUES(?,?,?,?,?,?,?,?)",meetings);
        long persisted=target.queryForObject("SELECT COUNT(*) FROM section_meetings m JOIN course_sections s ON s.id=m.section_id WHERE s.source_import_key=?",Long.class,hash);
        if(persisted!=meetings.size())throw new IllegalStateException("Số buổi học sau nhập không khớp với nguồn; đã hủy giao dịch.");
        target.update("INSERT INTO timetable_app_imports(sha256,imported_at) VALUES(?,?)",hash,Timestamp.valueOf(LocalDateTime.now()));
        return "Đã nhập "+courses.size()+" môn, "+sections.size()+" lớp và "+meetings.size()+" dòng lịch; mở liên tục="+registrationAlwaysOpen+".";
    }
    private Map<String,Long> ids(String table){return target.query("SELECT code,id FROM "+table,rs->{Map<String,Long> result=new HashMap<>();while(rs.next())result.put(rs.getString(1),rs.getLong(2));return result;});}
    private static String text(Map<String,Object> row,String key){return row.get(key)==null?null:row.get(key).toString();}
    private void batch(String sql,List<Object[]> rows){for(int i=0;i<rows.size();i+=500)target.batchUpdate(sql,rows.subList(i,Math.min(i+500,rows.size())));}
}
