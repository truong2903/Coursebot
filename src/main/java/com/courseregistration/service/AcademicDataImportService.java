package com.courseregistration.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

/** Imports an entire validated academic dataset into an empty application database. */
@Service
public class AcademicDataImportService {
    private final JdbcTemplate target;
    private final PasswordEncoder encoder;
    public AcademicDataImportService(JdbcTemplate target, PasswordEncoder encoder) { this.target=target; this.encoder=encoder; }

    @Transactional
    public String importSource(String sourceUrl, String initialPassword) {
        if(!sourceUrl.startsWith("jdbc:h2:file:")) throw new IllegalArgumentException("Nguồn học vụ phải là H2 file cục bộ.");
        var source=new JdbcTemplate(new DriverManagerDataSource(sourceUrl+";IFEXISTS=TRUE;ACCESS_MODE_DATA=r","sa",""));
        String hash=source.queryForObject("SELECT sha256 FROM source_import",String.class);
        if(target.queryForObject("SELECT COUNT(*) FROM academic_data_imports WHERE sha256=?",Integer.class,hash)>0)
            return "Dữ liệu học vụ đã được nhập; giữ nguyên hồ sơ, mật khẩu và các chỉnh sửa.";
        if(initialPassword==null||initialPassword.length()<10) throw new IllegalArgumentException("Cần mật khẩu khởi tạo tài khoản học vụ ít nhất 10 ký tự.");
        // Source codes are unrelated to the two school timetables. Never merge by guessing.
        for(String table:List.of("departments","academic_programs","administrative_classes","students","lecturers","courses","course_sections","semesters","curricula","academic_data_imports"))
            if(target.queryForObject("SELECT COUNT(*) FROM "+table,Long.class)>0)
                throw new IllegalStateException("Database đích đã có dữ liệu tại "+table+". Hãy dùng database ứng dụng riêng để nhập bộ học vụ.");
        for(var r:rows(source,"01_khoa")) target.update("INSERT INTO departments(code,name) VALUES(?,?)",r.get("MA_KHOA"),r.get("TEN_KHOA"));
        for(var r:rows(source,"02_nganh")) target.update("INSERT INTO academic_programs(code,name,department_code) VALUES(?,?,?)",r.get("MA_NGANH"),r.get("TEN_NGANH"),r.get("MA_KHOA"));
        for(var r:rows(source,"03_lop_hanh_chinh")) target.update("INSERT INTO administrative_classes(code,program_code,cohort) VALUES(?,?,?)",r.get("MA_LOP_HANH_CHINH"),r.get("MA_NGANH"),r.get("KHOA_HOC"));
        for(var r:rows(source,"04_sinh_vien")) {
            target.update("INSERT INTO students(student_code,full_name,program,cohort,email,administrative_class_code,phone,study_status) VALUES(?,?,?,?,?,?,?,?)",
                r.get("MA_SINH_VIEN"),r.get("HO_TEN"),r.get("TEN_NGANH"),r.get("KHOA_HOC"),r.get("EMAIL"),r.get("MA_LOP_HANH_CHINH"),r.get("SO_DIEN_THOAI"),r.get("TRANG_THAI_HOC_TAP"));
            account(text(r,"EMAIL"),"STUDENT",text(r,"MA_SINH_VIEN"),null,initialPassword);
        }
        for(var r:rows(source,"05_giang_vien")) {
            target.update("INSERT INTO lecturers(lecturer_code,full_name,department,academic_department_code,subject_group,academic_degree,academic_title,phone,email) VALUES(?,?,?,?,?,?,?,?,?)",
                r.get("MA_GIANG_VIEN"),r.get("HO_TEN"),r.get("MA_KHOA"),r.get("MA_KHOA"),r.get("BO_MON"),r.get("HOC_VI"),r.get("HOC_HAM"),r.get("SO_DIEN_THOAI"),r.get("EMAIL"));
            account(text(r,"EMAIL"),"LECTURER",null,text(r,"MA_GIANG_VIEN"),initialPassword);
        }
        for(var r:rows(source,"06_hoc_phan")) target.update("INSERT INTO courses(code,name,credits,department,prerequisite,active) VALUES(?,?,?,?,?,TRUE)",
            r.get("MA_HOC_PHAN"),r.get("TEN_HOC_PHAN"),r.get("SO_TIN_CHI"),r.get("MA_KHOA"),"Không có môn tiên quyết");
        for(var r:rows(source,"14_lich_hoc_ky")) {
            LocalDate start=localDate(r,"NGAY_BAT_DAU"),end=localDate(r,"NGAY_KET_THUC");
            String status=LocalDate.now().isBefore(start)?"PLANNED":LocalDate.now().isAfter(end)?"COMPLETED":"ACTIVE";
            target.update("INSERT INTO semesters(code,name,starts_at,ends_at,registration_open_at,registration_close_at,status,registration_always_open,academic_year,term_number,week_one_starts_at,teaching_weeks) VALUES(?,?,?,?,?,?,?,FALSE,?,?,?,?)",
                r.get("MA_HOC_KY"),r.get("TEN_HOC_KY"),start,end,dateTime(r,"THOI_GIAN_MO_DANG_KY").toLocalDate(),dateTime(r,"THOI_GIAN_DONG_DANG_KY").toLocalDate(),status,
                r.get("NAM_HOC"),r.get("HOC_KY"),localDate(r,"NGAY_BAT_DAU_TUAN_1"),r.get("SO_TUAN_HOC"));
        }
        var students=ids("students","student_code"); var lecturers=ids("lecturers","lecturer_code");
        var courses=ids("courses","code"); var semesters=ids("semesters","code");
        for(var r:rows(source,"14_lich_hoc_ky")) target.update("INSERT INTO registration_periods(semester_id,starts_at,ends_at,status) VALUES(?,?,?,'SCHEDULED')",
            semesters.get(text(r,"MA_HOC_KY")),dateTime(r,"THOI_GIAN_MO_DANG_KY"),dateTime(r,"THOI_GIAN_DONG_DANG_KY"));
        Map<Integer,Map<String,Object>> periods=new HashMap<>();
        for(var r:rows(source,"15_tiet_hoc")) {
            periods.put(number(r,"MA_TIET"),r);
            target.update("INSERT INTO teaching_periods(code,starts_at,ends_at,session_name,confirmation_status) VALUES(?,?,?,?,?)",r.get("MA_TIET"),localTime(r,"GIO_BAT_DAU"),localTime(r,"GIO_KET_THUC"),r.get("BUOI"),r.get("TRANG_THAI_XAC_NHAN"));
        }
        Map<String,String> assigned=new HashMap<>();
        for(var r:rows(source,"08_phan_cong_giang_day")) {
            String previous=assigned.put(text(r,"MA_LOP_HOC_PHAN"),text(r,"MA_GIANG_VIEN"));
            if(previous!=null)throw new IllegalStateException("Một lớp có nhiều phân công; cần đối chiếu mô hình đồng giảng trước khi nhập.");
        }
        for(var r:rows(source,"07_lop_hoc_phan")) {
            String code=text(r,"MA_LOP_HOC_PHAN"),id=text(r,"MA_HOC_KY")+":"+code;
            int start=number(r,"TIET_BAT_DAU"),count=number(r,"SO_TIET");
            var first=periods.get(start); var last=periods.get(start+count-1);
            if(first==null||last==null)throw new IllegalStateException("Thiếu bảng tiết cho lớp "+code);
            String weeks=text(r,"TUAN_BAT_DAU")+"-"+text(r,"TUAN_KET_THUC");
            target.update("INSERT INTO course_sections(id,section_code,course_id,lecturer_id,semester_id,schedule,room,capacity,color,status,imported_enrolled,source_status,source_import_key,schedule_review_required) VALUES(?,?,?,?,?,?,?,?,?,'OPEN',0,?,?,FALSE)",
                id,code,courses.get(text(r,"MA_HOC_PHAN")),lecturers.get(assigned.get(code)),semesters.get(text(r,"MA_HOC_KY")),"Lịch theo tiết",r.get("PHONG_HOC"),r.get("SI_SO_TOI_DA"),"lavender","Dữ liệu học vụ mẫu",hash);
            target.update("INSERT INTO section_meetings(section_id,day_of_week,starts_at,ends_at,room,weeks_expression,start_period,period_count,time_source_status) VALUES(?,?,?,?,?,?,?,?,?)",
                id,number(r,"THU")-1,localTime(first,"GIO_BAT_DAU"),localTime(last,"GIO_KET_THUC"),r.get("PHONG_HOC"),weeks,start,count,first.get("TRANG_THAI_XAC_NHAN"));
        }
        for(var r:source.queryForList("SELECT c.*,p.ten_nganh FROM src_09_chuong_trinh_dao_tao c JOIN src_02_nganh p ON p.ma_nganh=c.ma_nganh"))
            target.update("INSERT INTO curricula(code,name,program,cohort,version,status) VALUES(?,?,?,?,?,'ACTIVE')",r.get("MA_CHUONG_TRINH"),r.get("TEN_CHUONG_TRINH"),r.get("TEN_NGANH"),r.get("KHOA_AP_DUNG"),r.get("PHIEN_BAN"));
        var curricula=ids("curricula","code"); int order=0;
        for(var r:rows(source,"10_ctdt_hoc_phan")) target.update("INSERT INTO curriculum_courses(curriculum_id,course_id,suggested_semester,required_course,order_index) VALUES(?,?,?,?,?)",
            curricula.get(text(r,"MA_CHUONG_TRINH")),courses.get(text(r,"MA_HOC_PHAN")),text(r,"HOC_KY_DU_KIEN"),"Bắt buộc".equals(text(r,"LOAI_HOC_PHAN")),order++);
        Map<String,List<String>> conditions=new LinkedHashMap<>();
        for(var r:rows(source,"11_dieu_kien_hoc_phan")) {
            target.update("INSERT INTO course_conditions(course_id,condition_course_id,condition_type) VALUES(?,?,?)",courses.get(text(r,"MA_HOC_PHAN")),courses.get(text(r,"MA_MON_DIEU_KIEN")),r.get("LOAI_DIEU_KIEN"));
            conditions.computeIfAbsent(text(r,"MA_HOC_PHAN"),k->new ArrayList<>()).add(text(r,"LOAI_DIEU_KIEN")+": "+text(r,"MA_MON_DIEU_KIEN"));
            if("Tiên quyết".equals(text(r,"LOAI_DIEU_KIEN"))) target.update("INSERT INTO course_prerequisites(course_id,prerequisite_code) VALUES(?,?)",courses.get(text(r,"MA_HOC_PHAN")),r.get("MA_MON_DIEU_KIEN"));
        }
        conditions.forEach((code,values)->target.update("UPDATE courses SET prerequisite=? WHERE code=?",String.join("; ",values),code));
        Set<String> completed=new HashSet<>();
        for(var r:rows(source,"12_ket_qua_hoc_tap")) {
            target.update("INSERT INTO academic_results(student_id,course_id,semester_id,outcome,grade,letter_grade) VALUES(?,?,?,?,?,?)",
                students.get(text(r,"MA_SINH_VIEN")),courses.get(text(r,"MA_HOC_PHAN")),semesters.get(text(r,"MA_HOC_KY")),r.get("KET_QUA"),r.get("DIEM"),r.get("DIEM_CHU"));
            String key=text(r,"MA_SINH_VIEN")+":"+text(r,"MA_HOC_PHAN");
            if("Đạt".equals(text(r,"KET_QUA"))&&completed.add(key)) target.update("INSERT INTO student_completed_courses(student_id,course_code) VALUES(?,?)",students.get(text(r,"MA_SINH_VIEN")),r.get("MA_HOC_PHAN"));
        }
        for(var r:rows(source,"13_dang_ky")) {
            String status=switch(text(r,"TRANG_THAI_DANG_KY")){case "Đã đăng ký"->"ENROLLED";case "Đã hủy"->"CANCELLED";case "Chờ xác nhận"->"PENDING";default->throw new IllegalStateException("Trạng thái đăng ký không hỗ trợ");};
            target.update("INSERT INTO enrollments(student_id,section_id,enrolled_at,status,enrollment_date_only) VALUES(?,?,?,?,TRUE)",students.get(text(r,"MA_SINH_VIEN")),text(r,"MA_HOC_KY")+":"+text(r,"MA_LOP_HOC_PHAN"),LocalDate.parse(text(r,"NGAY_DANG_KY")).atStartOfDay(),status);
        }
        verifyCounts(source);
        // A training account is provided only for this explicitly isolated demo dataset.
        account("academic_training","TRAINING_OFFICE",null,null,initialPassword);
        target.update("INSERT INTO academic_data_imports(sha256,imported_at,manifest_json) VALUES(?,?,?)",hash,LocalDateTime.now(),source.queryForObject("SELECT manifest_json FROM source_import",String.class));
        return "Đã nhập bộ học vụ: "+students.size()+" sinh viên, "+lecturers.size()+" giảng viên, "+courses.size()+" môn, "+assigned.size()+" lớp; giữ trạng thái xác nhận của bảng tiết nguồn.";
    }
    private void verifyCounts(JdbcTemplate source) {
        Map<String,String> tables=Map.ofEntries(Map.entry("01_khoa","departments"),Map.entry("02_nganh","academic_programs"),Map.entry("03_lop_hanh_chinh","administrative_classes"),Map.entry("04_sinh_vien","students"),Map.entry("05_giang_vien","lecturers"),Map.entry("06_hoc_phan","courses"),Map.entry("07_lop_hoc_phan","course_sections"),Map.entry("09_chuong_trinh_dao_tao","curricula"),Map.entry("10_ctdt_hoc_phan","curriculum_courses"),Map.entry("11_dieu_kien_hoc_phan","course_conditions"),Map.entry("12_ket_qua_hoc_tap","academic_results"),Map.entry("13_dang_ky","enrollments"),Map.entry("14_lich_hoc_ky","semesters"),Map.entry("15_tiet_hoc","teaching_periods"));
        tables.forEach((from,to)->{
            if(!Objects.equals(source.queryForObject("SELECT COUNT(*) FROM src_"+from,Long.class),target.queryForObject("SELECT COUNT(*) FROM "+to,Long.class)))
                throw new IllegalStateException("Số lượng sau nhập không khớp: "+to);
        });
        long assignments=source.queryForObject("SELECT COUNT(*) FROM src_08_phan_cong_giang_day",Long.class);
        if(assignments!=target.queryForObject("SELECT COUNT(*) FROM course_sections WHERE lecturer_id IS NOT NULL",Long.class))throw new IllegalStateException("Thiếu phân công giảng dạy");
    }
    private void account(String username,String role,String student,String lecturer,String password) {
        if(target.queryForObject("SELECT COUNT(*) FROM user_accounts WHERE LOWER(username)=LOWER(?) OR LOWER(email)=LOWER(?)",Long.class,username,username)>0)
            throw new IllegalStateException("Tài khoản đã tồn tại: "+username);
        target.update("INSERT INTO user_accounts(username,password_hash,role,status,student_code,lecturer_code,email,created_at,updated_at) VALUES(?,?,?,'ACTIVE',?,?,?,?,?)",
            username,encoder.encode(password),role,student,lecturer,username.contains("@")?username:null,LocalDateTime.now(),LocalDateTime.now());
    }
    private Map<String,Long> ids(String table,String key){return target.query("SELECT "+key+",id FROM "+table,rs->{Map<String,Long> result=new HashMap<>();while(rs.next())result.put(rs.getString(1),rs.getLong(2));return result;});}
    private static List<Map<String,Object>> rows(JdbcTemplate source,String name){return source.queryForList("SELECT * FROM src_"+name);}
    private static String text(Map<String,Object> row,String key){return Objects.toString(row.get(key),null);}
    private static int number(Map<String,Object> row,String key){return ((Number)row.get(key)).intValue();}
    private static LocalDate localDate(Map<String,Object> row,String key){Object value=row.get(key);return value==null?null:value instanceof LocalDate d?d:value instanceof java.sql.Date d?d.toLocalDate():LocalDate.parse(value.toString());}
    private static LocalTime localTime(Map<String,Object> row,String key){Object value=row.get(key);return value==null?null:value instanceof LocalTime t?t:value instanceof java.sql.Time t?t.toLocalTime():LocalTime.parse(value.toString());}
    private static LocalDateTime dateTime(Map<String,Object> row,String key){Object value=row.get(key);return value==null?null:value instanceof LocalDateTime dt?dt:value instanceof java.sql.Timestamp t?t.toLocalDateTime():LocalDateTime.parse(value.toString().replace(' ','T'));}
}
