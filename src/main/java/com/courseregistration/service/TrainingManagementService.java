package com.courseregistration.service;

import com.courseregistration.dto.*;
import com.courseregistration.entity.*;
import com.courseregistration.repository.*;
import com.courseregistration.service.policy.CourseConditionEvaluator;
import com.courseregistration.service.policy.EnrollmentRule;
import com.courseregistration.service.policy.EnrollmentValidationContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TrainingManagementService {
    private final CourseRepository courses;
    private final SemesterRepository semesters;
    private final CourseSectionRepository sections;
    private final LecturerRepository lecturers;
    private final EnrollmentRepository enrollments;
    private final WaitlistRepository waitlists;
    private final RegistrationPeriodRepository periods;
    private final CurriculumRepository curricula;
    private final CurriculumCourseRepository curriculumCourses;
    private final AuditService audit;
    private final List<EnrollmentRule> enrollmentRules;
    private final CourseConditionEvaluator conditionEvaluator;
    private final int dropWindowDays;

    public TrainingManagementService(CourseRepository courses,
                                     SemesterRepository semesters,
                                     CourseSectionRepository sections,
                                     LecturerRepository lecturers,
                                     EnrollmentRepository enrollments,
                                     WaitlistRepository waitlists,
                                     RegistrationPeriodRepository periods,
                                     CurriculumRepository curricula,
                                     CurriculumCourseRepository curriculumCourses,
                                     AuditService audit,
                                     List<EnrollmentRule> enrollmentRules,
                                     CourseConditionEvaluator conditionEvaluator,
                                     @Value("${app.enrollment.drop-window-days:7}") int dropWindowDays) {
        this.courses = courses;
        this.semesters = semesters;
        this.sections = sections;
        this.lecturers = lecturers;
        this.enrollments = enrollments;
        this.waitlists = waitlists;
        this.periods = periods;
        this.curricula = curricula;
        this.curriculumCourses = curriculumCourses;
        this.audit = audit;
        this.enrollmentRules = List.copyOf(enrollmentRules);
        this.conditionEvaluator = conditionEvaluator;
        this.dropWindowDays = dropWindowDays;
    }

    @Transactional(readOnly=true)
    public List<CourseManagementDto> listCourses(){return courses.findAll().stream().sorted(Comparator.comparing(Course::getCode)).map(CourseManagementDto::from).toList();}
    @Transactional
    public CourseManagementDto createCourse(CourseManagementRequest r){
        String code=r.code().trim().toUpperCase(Locale.ROOT);if(courses.existsByCodeIgnoreCase(code))throw new IllegalArgumentException("Mã môn học đã tồn tại.");
        Course c=new Course(code,r.name().trim(),r.department().trim(),r.credits(),blank(r.prerequisite()));c.update(r.name().trim(),r.department().trim(),r.credits(),blank(r.prerequisite()),blank(r.description()));
        c.setSyllabusUrl(allowedUrl(r.syllabusUrl()));if(r.active()!=null)c.setActive(r.active());courses.save(c);audit.record("COURSE_CREATED",code,"Tạo môn học");return CourseManagementDto.from(c);
    }
    @Transactional
    public CourseManagementDto updateCourse(String code,CourseManagementRequest r){
        Course c=course(code);String normalized=r.code().trim().toUpperCase(Locale.ROOT);
        if(!c.getCode().equalsIgnoreCase(normalized)&&courses.existsByCodeIgnoreCase(normalized))throw new IllegalArgumentException("Mã môn học đã tồn tại.");
        if(!c.getCode().equalsIgnoreCase(normalized))throw new IllegalArgumentException("Không thể đổi mã môn học đã được tham chiếu. Hãy tạo môn học mới.");
        c.update(r.name().trim(),r.department().trim(),r.credits(),blank(r.prerequisite()),blank(r.description()));c.setSyllabusUrl(allowedUrl(r.syllabusUrl()));if(r.active()!=null)c.setActive(r.active());
        audit.record("COURSE_UPDATED",code,"Cập nhật môn học");return CourseManagementDto.from(c);
    }
    @Transactional
    public void archiveCourse(String code){Course c=course(code);c.setActive(false);audit.record("COURSE_ARCHIVED",code,"Ngừng sử dụng môn học");}

    @Transactional(readOnly=true)
    public List<SemesterManagementDto> listSemesters(){return semesters.findAllByOrderByStartsAtDesc().stream().map(SemesterManagementDto::from).toList();}
    @Transactional
    public SemesterManagementDto createSemester(SemesterManagementRequest r){
        String code=r.code().trim();if(semesters.existsByCodeIgnoreCase(code))throw new IllegalArgumentException("Mã học kỳ đã tồn tại.");validateSemesterDates(r,Boolean.TRUE.equals(r.registrationAlwaysOpen()));
        ensureSemesterNoOverlap(r.startsAt(),r.endsAt(),null);
        Semester s=new Semester(code,r.name().trim(),r.startsAt(),r.registrationOpenAt(),r.registrationCloseAt());
        s.update(r.name().trim(),r.startsAt(),r.endsAt(),r.registrationOpenAt(),r.registrationCloseAt(),r.status());
        s.setRegistrationAlwaysOpen(Boolean.TRUE.equals(r.registrationAlwaysOpen()));
        semesters.save(s);
        syncRegistrationPeriodForSemester(s);
        audit.record("SEMESTER_CREATED",code,"Tạo học kỳ");return SemesterManagementDto.from(s);
    }
    @Transactional
    public SemesterManagementDto updateSemester(Long id,SemesterManagementRequest r){
        Semester s=semesters.findById(id).orElseThrow(()->new IllegalArgumentException("Không tìm thấy học kỳ."));
        if(!s.getCode().equalsIgnoreCase(r.code().trim()))throw new IllegalArgumentException("Không thể đổi mã học kỳ đã được tham chiếu.");
        boolean manual=r.registrationAlwaysOpen()==null?s.isRegistrationAlwaysOpen():r.registrationAlwaysOpen();
        validateSemesterDates(r,manual);ensureSemesterNoOverlap(r.startsAt(),r.endsAt(),id);
        s.update(r.name().trim(),r.startsAt(),r.endsAt(),r.registrationOpenAt(),r.registrationCloseAt(),r.status());
        s.setRegistrationAlwaysOpen(manual);
        semesters.save(s);
        syncRegistrationPeriodForSemester(s);
        audit.record("SEMESTER_UPDATED",s.getCode(),"Cập nhật học kỳ");return SemesterManagementDto.from(s);
    }
    @Transactional
    public void archiveSemester(Long id){Semester s=semesters.findById(id).orElseThrow(()->new IllegalArgumentException("Không tìm thấy học kỳ."));s.update(s.getName(),s.getStartsAt(),s.getEndsAt(),s.getRegistrationOpenAt(),s.getRegistrationCloseAt(),Semester.Status.ARCHIVED);audit.record("SEMESTER_ARCHIVED",s.getCode(),"Lưu trữ học kỳ");}
    private void validateSemesterDates(SemesterManagementRequest r,boolean manual){
        if((r.startsAt()==null)!=(r.endsAt()==null))throw new IllegalArgumentException("Cần khai báo cả ngày bắt đầu và kết thúc học kỳ.");
        if((r.registrationOpenAt()==null)!=(r.registrationCloseAt()==null))throw new IllegalArgumentException("Cần khai báo cả ngày mở và đóng đăng ký.");
        if(r.startsAt()!=null&&!r.startsAt().isBefore(r.endsAt()))throw new IllegalArgumentException("Ngày bắt đầu học kỳ phải trước ngày kết thúc.");
        if(r.registrationOpenAt()!=null&&r.registrationOpenAt().isAfter(r.registrationCloseAt()))throw new IllegalArgumentException("Thời gian đăng ký không hợp lệ.");
        if(r.endsAt()!=null&&r.registrationOpenAt()!=null&&r.endsAt().isBefore(r.registrationCloseAt()))throw new IllegalArgumentException("Đợt đăng ký không thể kết thúc sau khi học kỳ kết thúc.");
    }
    private void ensureSemesterNoOverlap(LocalDate start,LocalDate end,Long excluded){
        if(start==null||end==null)return;
        semesters.findAll().stream().filter(s->!Objects.equals(s.getId(),excluded)&&s.getStartsAt()!=null&&s.getEndsAt()!=null)
                .filter(s->!start.isAfter(s.getEndsAt())&&!end.isBefore(s.getStartsAt()))
                .findAny().ifPresent(s->{throw new IllegalArgumentException("Khoảng thời gian trùng với học kỳ "+s.getCode()+".");});
    }

    @Transactional(readOnly=true)
    public List<SectionManagementDto> listSections(){var counts=enrollments.activeCountsBySection().stream().collect(Collectors.toMap(r->(String)r[0],r->((Number)r[1]).longValue()));return sections.findAll().stream().sorted(Comparator.comparing(s->s.getSemester().getCode()+s.getSectionCode())).map(s->SectionManagementDto.from(s,s.totalEnrolled(counts.getOrDefault(s.getId(),0L)))).toList();}
    @Transactional
    public SectionManagementDto createSection(SectionManagementRequest r){
        Course c=course(r.courseCode());if(!c.isActive())throw new IllegalArgumentException("Môn học đã ngừng sử dụng.");
        Semester s=semester(r.semesterCode());Lecturer l=optionalLecturer(r.lecturerCode());var meetings=requestedMeetings(r,null);validateSection(r,null,s,l,meetings);
        String id=blank(r.id());if(id==null)id=UUID.randomUUID().toString();if(sections.existsById(id))throw new IllegalArgumentException("Mã định danh lớp đã tồn tại.");
        if(sections.existsBySectionCodeIgnoreCaseAndSemester_Code(r.sectionCode().trim(),s.getCode()))throw new IllegalArgumentException("Mã lớp học phần đã tồn tại trong học kỳ.");
        CourseSection section=new CourseSection(id,r.sectionCode().trim(),c,l,s,"Nhiều buổi học","Chưa có phòng",r.capacity(),"lavender");section.replaceMeetings(meetings);section.setImportedEnrolled(r.importedEnrolled());section.setStatus(r.status());sections.save(section);
        audit.record("SECTION_CREATED",r.sectionCode(),"Tạo lớp học phần");return sectionDto(section);
    }
    @Transactional
    public SectionManagementDto updateSection(String id,SectionManagementRequest r){
        CourseSection section=sections.findById(id).orElseThrow(()->new IllegalArgumentException("Không tìm thấy lớp học phần."));
        Course c=course(r.courseCode());Semester s=semester(r.semesterCode());Lecturer l=optionalLecturer(r.lecturerCode());var meetings=requestedMeetings(r,section);validateSection(r,id,s,l,meetings);
        if((!section.getSectionCode().equalsIgnoreCase(r.sectionCode().trim())||!section.getSemester().getCode().equals(s.getCode()))&&sections.existsBySectionCodeIgnoreCaseAndSemester_Code(r.sectionCode().trim(),s.getCode()))throw new IllegalArgumentException("Mã lớp học phần đã tồn tại trong học kỳ.");
        if(!section.getSemester().getCode().equals(s.getCode())&&enrollments.countBySection_IdAndStatus(id,Enrollment.Status.ENROLLED)>0)throw new IllegalArgumentException("Không thể chuyển học kỳ của lớp đã có sinh viên đăng ký.");
        section.update(c,l,s,r.sectionCode().trim(),"Nhiều buổi học","Chưa có phòng",r.capacity());section.replaceMeetings(meetings);if(r.importedEnrolled()!=null)section.setImportedEnrolled(r.importedEnrolled());section.setStatus(r.status());audit.record("SECTION_UPDATED",r.sectionCode(),"Cập nhật lớp học phần");return sectionDto(section);
    }
    @Transactional
    public void cancelSection(String id){CourseSection section=sections.findById(id).orElseThrow(()->new IllegalArgumentException("Không tìm thấy lớp học phần."));if(section.getStatus()==CourseSection.Status.CANCELLED)throw new IllegalArgumentException("Lớp học phần đã bị hủy.");section.setStatus(CourseSection.Status.CANCELLED);audit.record("SECTION_CANCELLED",section.getSectionCode(),"Hủy lớp học phần");}
    private List<SectionMeeting> requestedMeetings(SectionManagementRequest r,CourseSection original){
        if(r.meetings()!=null){if(r.meetings().isEmpty())throw new IllegalArgumentException("Cần khai báo ít nhất một buổi học.");return r.meetings().stream().map(MeetingDto::toEntity).toList();}
        if(original!=null&&Objects.equals(r.schedule(),original.getSchedule())&&Objects.equals(r.room(),original.getRoom()))return original.getEffectiveMeetings().stream().map(m->new SectionMeeting(m.getDayOfWeek(),m.getStartsAt(),m.getEndsAt(),m.getRoom(),m.getWeeksExpression())).toList();
        var meeting=SectionMeeting.legacy(r.schedule(),r.room());
        if(!meeting.hasValidTime())throw new IllegalArgumentException("Cần danh sách meetings hoặc lịch dạng Thứ 2 · 07:30 – 10:00.");
        return List.of(meeting);
    }
    private void validateSection(SectionManagementRequest r,String id,Semester semester,Lecturer lecturer,List<SectionMeeting> meetings){
        for(var meeting:meetings)if(!meeting.hasValidTime()||meeting.getWeeks()==null)throw new IllegalArgumentException("Lịch học chưa hợp lệ; cần xác nhận lại giờ và tuần học.");
        for(int i=0;i<meetings.size();i++)for(int j=i+1;j<meetings.size();j++)if(meetings.get(i).overlaps(meetings.get(j)))throw new IllegalArgumentException("Các buổi học trong cùng lớp bị trùng thời gian và tuần học.");
        if(id!=null){var current=sections.findById(id).orElseThrow();long local=enrollments.countBySection_IdAndStatus(id,Enrollment.Status.ENROLLED);int baseline=r.importedEnrolled()==null?(current.getImportedEnrolled()==null?0:current.getImportedEnrolled()):r.importedEnrolled();if(r.capacity()<baseline+local&&r.capacity()!=current.getCapacity())throw new IllegalArgumentException("Sĩ số tối đa không thể thấp hơn tổng sĩ số nhập từ trường và đăng ký tại hệ thống.");}
        if(r.status()==CourseSection.Status.CANCELLED)return;
        for(CourseSection other:sections.findAllBySemester_CodeOrderBySectionCode(semester.getCode())){
            if(Objects.equals(other.getId(),id)||other.getStatus()==CourseSection.Status.CANCELLED)continue;
            for(var requested:meetings)for(var occupied:other.getEffectiveMeetings()){
                if(!requested.overlaps(occupied))continue;
                if(lecturer!=null&&other.getLecturer()!=null&&other.getLecturer().getId().equals(lecturer.getId()))throw new IllegalArgumentException("Giảng viên đã có lịch trùng với lớp "+other.getSectionCode()+".");
                if(requested.getRoom()!=null&&!requested.getRoom().isBlank()&&occupied.getRoom()!=null&&occupied.getRoom().equalsIgnoreCase(requested.getRoom()))throw new IllegalArgumentException("Phòng học trùng với lớp "+other.getSectionCode()+" trong cùng tuần.");
            }
        }
    }
    private Lecturer optionalLecturer(String code){return code==null||code.isBlank()?null:lecturer(code);}
    private SectionManagementDto sectionDto(CourseSection s){return SectionManagementDto.from(s,s.totalEnrolled(enrollments.countBySection_IdAndStatus(s.getId(),Enrollment.Status.ENROLLED)));}

    @Transactional(readOnly=true)
    public List<RegistrationPeriodDto> listPeriods(){return periods.findAllByOrderByStartsAtDesc().stream().map(RegistrationPeriodDto::from).toList();}
    @Transactional
    public RegistrationPeriodDto createPeriod(RegistrationPeriodRequest r){
        Semester s=semester(r.semesterCode());if(periods.existsBySemester_Code(s.getCode()))throw new IllegalArgumentException("Học kỳ này đã có đợt đăng ký. Hãy cập nhật đợt hiện tại.");validatePeriod(r,null);
        RegistrationPeriod p=new RegistrationPeriod(s,r.startsAt(),r.endsAt(),r.status());periods.save(p);syncSemesterDates(s,r.startsAt(),r.endsAt());audit.record("REGISTRATION_PERIOD_CREATED",s.getCode(),"Tạo đợt đăng ký");return RegistrationPeriodDto.from(p);
    }
    @Transactional
    public RegistrationPeriodDto updatePeriod(Long id,RegistrationPeriodRequest r){
        RegistrationPeriod p=periods.findById(id).orElseThrow(()->new IllegalArgumentException("Không tìm thấy đợt đăng ký."));Semester s=semester(r.semesterCode());
        if(!p.getSemester().getCode().equals(s.getCode())&&periods.existsBySemester_Code(s.getCode()))throw new IllegalArgumentException("Học kỳ đã có đợt đăng ký khác.");
        validatePeriod(r,id);p.update(s,r.startsAt(),r.endsAt(),r.status());syncSemesterDates(s,r.startsAt(),r.endsAt());audit.record("REGISTRATION_PERIOD_UPDATED",s.getCode(),"Cập nhật đợt đăng ký");return RegistrationPeriodDto.from(p);
    }
    @Transactional
    public void cancelPeriod(Long id){RegistrationPeriod p=periods.findById(id).orElseThrow(()->new IllegalArgumentException("Không tìm thấy đợt đăng ký."));if(p.getEffectiveStatus()==RegistrationPeriod.Status.OPEN)throw new IllegalArgumentException("Hãy đóng đợt đăng ký đang mở trước khi hủy.");p.update(p.getSemester(),p.getStartsAt(),p.getEndsAt(),RegistrationPeriod.Status.CANCELLED);audit.record("REGISTRATION_PERIOD_CANCELLED",p.getSemester().getCode(),"Hủy đợt đăng ký");}
    private void validatePeriod(RegistrationPeriodRequest r,Long ignored){if(!r.startsAt().isBefore(r.endsAt()))throw new IllegalArgumentException("Thời điểm bắt đầu phải trước thời điểm kết thúc.");if(r.status()==RegistrationPeriod.Status.OPEN&&(LocalDateTime.now().isBefore(r.startsAt())||LocalDateTime.now().isAfter(r.endsAt())))throw new IllegalArgumentException("Chỉ có thể mở đợt đăng ký trong khoảng thời gian đã cấu hình.");}
    private void syncSemesterDates(Semester s,LocalDateTime start,LocalDateTime end){s.setDates(s.getStartsAt(),start.toLocalDate(),end.toLocalDate());s.setRegistrationAlwaysOpen(false);}
    private void syncRegistrationPeriodForSemester(Semester s) {
        if (s.getRegistrationOpenAt() == null || s.getRegistrationCloseAt() == null) return;
        LocalDateTime start = s.getRegistrationOpenAt().atStartOfDay();
        LocalDateTime end = s.getRegistrationCloseAt().atTime(23, 59, 59);
        LocalDateTime now = LocalDateTime.now();
        RegistrationPeriod.Status status;
        if (s.isRegistrationAlwaysOpen()) {
            status = RegistrationPeriod.Status.OPEN;
        } else if (now.isBefore(start)) {
            status = RegistrationPeriod.Status.SCHEDULED;
        } else if (now.isAfter(end)) {
            status = RegistrationPeriod.Status.CLOSED;
        } else {
            status = RegistrationPeriod.Status.OPEN;
        }
        var opt = periods.findBySemester_Code(s.getCode());
        if (opt.isPresent()) {
            RegistrationPeriod p = opt.get();
            p.update(s, start, end, status);
            periods.save(p);
        } else {
            periods.save(new RegistrationPeriod(s, start, end, status));
        }
    }

    @Transactional(readOnly=true)
    public List<CurriculumDto> listCurricula(){return curricula.findAll().stream().sorted(Comparator.comparing(Curriculum::getCode)).map(CurriculumDto::from).toList();}
    @Transactional
    public CurriculumDto createCurriculum(CurriculumRequest r){String code=r.code().trim();if(curricula.existsByCodeIgnoreCase(code))throw new IllegalArgumentException("Mã chương trình đã tồn tại.");Curriculum c=new Curriculum(code,r.name().trim(),r.program().trim(),r.cohort().trim(),r.version().trim(),r.status()==null?Curriculum.Status.DRAFT:r.status());curricula.save(c);audit.record("CURRICULUM_CREATED",code,"Tạo khung chương trình");return CurriculumDto.from(c);}
    @Transactional
    public CurriculumDto updateCurriculum(Long id,CurriculumRequest r){Curriculum c=curricula.findById(id).orElseThrow(()->new IllegalArgumentException("Không tìm thấy khung chương trình."));if(!c.getCode().equalsIgnoreCase(r.code().trim()))throw new IllegalArgumentException("Không thể đổi mã chương trình đã được tham chiếu.");if(c.getStatus()==Curriculum.Status.ACTIVE)throw new IllegalArgumentException("Khung chương trình đang áp dụng không thể sửa trực tiếp. Hãy tạo phiên bản mới.");c.update(r.name().trim(),r.program().trim(),r.cohort().trim(),r.version().trim(),r.status()==null?c.getStatus():r.status());audit.record("CURRICULUM_UPDATED",c.getCode(),"Cập nhật khung chương trình");return CurriculumDto.from(c);}
    @Transactional
    public void archiveCurriculum(Long id){Curriculum c=curricula.findById(id).orElseThrow(()->new IllegalArgumentException("Không tìm thấy khung chương trình."));c.update(c.getName(),c.getProgram(),c.getCohort(),c.getVersion(),Curriculum.Status.ARCHIVED);audit.record("CURRICULUM_ARCHIVED",c.getCode(),"Lưu trữ khung chương trình");}
    @Transactional(readOnly=true)
    public List<CurriculumCourseDto> listCurriculumCourses(String code){curriculum(code);return curriculumCourses.findAllByCurriculum_CodeOrderBySuggestedSemesterAscOrderIndexAsc(code).stream().map(CurriculumCourseDto::from).toList();}
    @Transactional
    public CurriculumCourseDto addCurriculumCourse(String code,CurriculumCourseRequest r){Curriculum c=curriculum(code);if(c.getStatus()==Curriculum.Status.ACTIVE)throw new IllegalArgumentException("Không thể sửa trực tiếp chương trình đang áp dụng.");Course course=course(r.courseCode());if(curriculumCourses.existsByCurriculum_CodeAndCourse_Code(code,course.getCode()))throw new IllegalArgumentException("Môn học đã có trong khung chương trình.");CurriculumCourse entry=new CurriculumCourse(c,course,r.suggestedSemester().trim(),r.requiredCourse(),r.orderIndex());curriculumCourses.save(entry);audit.record("CURRICULUM_COURSE_ADDED",code,"Thêm môn "+course.getCode());return CurriculumCourseDto.from(entry);}
    @Transactional
    public CurriculumCourseDto updateCurriculumCourse(String code,String courseCode,CurriculumCourseRequest r){Curriculum c=curriculum(code);if(c.getStatus()==Curriculum.Status.ACTIVE)throw new IllegalArgumentException("Không thể sửa trực tiếp chương trình đang áp dụng.");if(!r.courseCode().equalsIgnoreCase(courseCode))throw new IllegalArgumentException("Mã môn trong yêu cầu không khớp với môn cần cập nhật.");CurriculumCourse entry=curriculumCourses.findByCurriculum_CodeAndCourse_Code(code,courseCode).orElseThrow(()->new IllegalArgumentException("Môn học không có trong khung chương trình."));entry.update(r.suggestedSemester().trim(),r.requiredCourse(),r.orderIndex());audit.record("CURRICULUM_COURSE_UPDATED",code,"Cập nhật môn "+entry.getCourse().getCode());return CurriculumCourseDto.from(entry);}
    @Transactional
    public void removeCurriculumCourse(String code,String courseCode){Curriculum c=curriculum(code);if(c.getStatus()==Curriculum.Status.ACTIVE)throw new IllegalArgumentException("Không thể sửa trực tiếp chương trình đang áp dụng.");CurriculumCourse entry=curriculumCourses.findByCurriculum_CodeAndCourse_Code(code,courseCode).orElseThrow(()->new IllegalArgumentException("Môn học không có trong khung chương trình."));curriculumCourses.delete(entry);audit.record("CURRICULUM_COURSE_REMOVED",code,"Gỡ môn "+courseCode);}

    @Transactional(readOnly=true)
    public List<PrerequisiteDto> listPrerequisites(){return courses.findAll().stream().flatMap(course->course.getPrerequisiteCodes().stream().map(code->{
        Course prerequisite=courses.findByCodeIgnoreCase(code).orElse(null);
        return new PrerequisiteDto(course.getCode()+"~"+code,course.getCode(),course.getName(),code,prerequisite==null?"Không tìm thấy môn":prerequisite.getName());
    })).toList();}
    @Transactional
    public PrerequisiteDto addPrerequisite(String courseCode,String prerequisiteCode){
        Course course=course(courseCode),prerequisite=course(prerequisiteCode);
        if(course.getCode().equalsIgnoreCase(prerequisite.getCode()))throw new IllegalArgumentException("Môn học không thể là tiên quyết của chính nó.");
        if(course.getPrerequisiteCodes().contains(prerequisite.getCode()))throw new IllegalArgumentException("Quan hệ tiên quyết đã tồn tại.");
        if(dependsOn(prerequisite.getCode(),course.getCode(),new HashSet<>()))throw new IllegalArgumentException("Quan hệ mới tạo thành chu trình tiên quyết.");
        Set<String> next=new LinkedHashSet<>(course.getPrerequisiteCodes());next.add(prerequisite.getCode());course.setPrerequisiteCodes(next);course.setPrerequisite(prerequisiteLabel(course));audit.record("PREREQUISITE_ADDED",course.getCode(),"Tiên quyết "+prerequisite.getCode());
        return new PrerequisiteDto(course.getCode()+"~"+prerequisite.getCode(),course.getCode(),course.getName(),prerequisite.getCode(),prerequisite.getName());
    }
    @Transactional
    public PrerequisiteDto updatePrerequisite(String key,String courseCode,String prerequisiteCode){
        String[] parts=key.split("~",2);if(parts.length!=2)throw new IllegalArgumentException("Mã quan hệ tiên quyết không hợp lệ.");
        deletePrerequisite(parts[0],parts[1]);return addPrerequisite(courseCode,prerequisiteCode);
    }
    @Transactional
    public void deletePrerequisite(String courseCode,String prerequisiteCode){Course course=course(courseCode);if(!course.getPrerequisiteCodes().contains(prerequisiteCode))throw new IllegalArgumentException("Không tìm thấy quan hệ tiên quyết.");Set<String> next=new LinkedHashSet<>(course.getPrerequisiteCodes());next.remove(prerequisiteCode);course.setPrerequisiteCodes(next);course.setPrerequisite(prerequisiteLabel(course));audit.record("PREREQUISITE_REMOVED",courseCode,"Gỡ tiên quyết "+prerequisiteCode);}

    // --- Điều phối đăng ký chờ xác nhận (PENDING) & Hủy môn hộ sinh viên quá hạn ---

    @Transactional(readOnly = true)
    public List<EnrollmentAdminDto> listEnrollments(String semesterCode, Enrollment.Status status, String query) {
        var counts = enrollments.activeCountsBySection().stream()
                .collect(Collectors.toMap(r -> (String) r[0], r -> ((Number) r[1]).longValue()));
        String cleanTerm = semesterCode == null ? "" : semesterCode.trim();
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        return enrollments.findAllForManagement().stream()
                .filter(e -> cleanTerm.isEmpty() || e.getSection().getSemester().getCode().equalsIgnoreCase(cleanTerm))
                .filter(e -> status == null || e.getStatus() == status)
                .filter(e -> q.isEmpty()
                        || e.getStudent().getStudentCode().toLowerCase(Locale.ROOT).contains(q)
                        || e.getStudent().getFullName().toLowerCase(Locale.ROOT).contains(q)
                        || e.getSection().getCourse().getCode().toLowerCase(Locale.ROOT).contains(q)
                        || e.getSection().getCourse().getName().toLowerCase(Locale.ROOT).contains(q)
                        || e.getSection().getSectionCode().toLowerCase(Locale.ROOT).contains(q))
                .map(e -> {
                    int occupied = e.getSection().totalEnrolled(counts.getOrDefault(e.getSection().getId(), 0L));
                    return EnrollmentAdminDto.from(e, occupied, dropWindowDays);
                })
                .toList();
    }

    @Transactional
    public String approvePendingEnrollment(Long id) {
        Enrollment enrollment = enrollments.findByIdWithDetails(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bản ghi đăng ký."));
        if (enrollment.getStatus() != Enrollment.Status.PENDING) {
            throw new IllegalStateException("Chỉ có thể duyệt bản ghi đang ở trạng thái Chờ xác nhận.");
        }
        CourseSection section = sections.findByIdForUpdate(enrollment.getSection().getId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lớp học phần."));
        if (section.getStatus() == CourseSection.Status.CANCELLED || !section.getCourse().isActive()) {
            throw new IllegalStateException("Lớp học phần đã hủy hoặc môn học ngừng sử dụng, không thể duyệt.");
        }
        Student student = enrollment.getStudent();
        var activeSections = enrollments
                .findAllByStudentAndSection_Semester_CodeAndStatusOrderByEnrolledAtAsc(
                        student, section.getSemester().getCode(), Enrollment.Status.ENROLLED)
                .stream().map(Enrollment::getSection).toList();
        var context = new EnrollmentValidationContext(student, section, activeSections, false, false);
        for (EnrollmentRule rule : enrollmentRules) {
            rule.validate(context);
        }
        int occupied = section.totalEnrolled(enrollments.countBySection_IdAndStatus(section.getId(), Enrollment.Status.ENROLLED));
        if (occupied >= section.getCapacity()) {
            throw new IllegalStateException("Lớp học phần đã đủ sĩ số tối đa (" + occupied + "/" + section.getCapacity() + "). Hãy tăng sĩ số tối đa trước khi duyệt.");
        }
        enrollment.approve();
        audit.record("ENROLLMENT_APPROVED", section.getSectionCode(),
                "Duyệt đăng ký chờ xác nhận môn " + section.getCourse().getCode() + " cho SV " + student.getStudentCode());
        return "Đã duyệt đăng ký học phần " + section.getCourse().getCode() + " (" + section.getSectionCode() + ") cho sinh viên " + student.getStudentCode() + ".";
    }

    @Transactional
    public String rejectPendingEnrollment(Long id, String reason) {
        Enrollment enrollment = enrollments.findByIdWithDetails(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bản ghi đăng ký."));
        if (enrollment.getStatus() != Enrollment.Status.PENDING) {
            throw new IllegalStateException("Chỉ có thể từ chối bản ghi đang ở trạng thái Chờ xác nhận.");
        }
        enrollment.cancel();
        String note = reason == null || reason.isBlank() ? "" : " — Lý do: " + reason.trim();
        audit.record("ENROLLMENT_REJECTED", enrollment.getSection().getSectionCode(),
                "Từ chối đăng ký chờ xác nhận môn " + enrollment.getSection().getCourse().getCode()
                        + " của SV " + enrollment.getStudent().getStudentCode() + note);
        return "Đã từ chối đăng ký chờ xác nhận môn " + enrollment.getSection().getCourse().getCode()
                + " của sinh viên " + enrollment.getStudent().getStudentCode() + ".";
    }

    @Transactional
    public String adminDropEnrollment(Long id, String reason) {
        Enrollment enrollment = enrollments.findByIdWithDetails(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bản ghi đăng ký."));
        if (enrollment.getStatus() != Enrollment.Status.ENROLLED) {
            throw new IllegalStateException("Chỉ có thể hủy học phần đang ở trạng thái Đang đăng ký.");
        }
        CourseSection section = sections.findByIdForUpdate(enrollment.getSection().getId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lớp học phần."));
        Student student = enrollment.getStudent();
        var activeSections = enrollments
                .findAllByStudentAndSection_Semester_CodeAndStatusOrderByEnrolledAtAsc(
                        student, section.getSemester().getCode(), Enrollment.Status.ENROLLED)
                .stream().map(Enrollment::getSection).toList();
        conditionEvaluator.checkCorequisiteDropViolation(student, section, activeSections)
                .ifPresent(msg -> { throw new IllegalStateException(msg); });

        enrollment.cancel();
        String note = reason == null || reason.isBlank() ? "" : " — Lý do: " + reason.trim();
        audit.record("ENROLLMENT_ADMIN_DROPPED", section.getSectionCode(),
                "Ban Đào tạo hủy học phần " + section.getCourse().getCode() + " hộ SV " + student.getStudentCode() + note);

        var queue = waitlists.findAllBySectionAndStatusOrderByCreatedAtAscIdAsc(section, WaitlistEntry.Status.WAITING);
        if (section.getStatus() == CourseSection.Status.OPEN && !section.isScheduleReviewRequired()
                && section.totalEnrolled(enrollments.countBySection_IdAndStatus(section.getId(), Enrollment.Status.ENROLLED)) < section.getCapacity()) {
            for (WaitlistEntry next : queue) {
                Student nextStudent = next.getStudent();
                var nextActive = enrollments
                        .findAllByStudentAndSection_Semester_CodeAndStatusOrderByEnrolledAtAsc(
                                nextStudent, section.getSemester().getCode(), Enrollment.Status.ENROLLED)
                        .stream().map(Enrollment::getSection).toList();
                var promoteCtx = new EnrollmentValidationContext(nextStudent, section, nextActive, false, false);
                if (enrollmentRules.stream().allMatch(r -> r.checkViolation(promoteCtx).isEmpty())) {
                    next.promote();
                    var prev = enrollments.findByStudentAndSection(nextStudent, section);
                    if (prev.isPresent()) prev.get().reEnroll();
                    else enrollments.save(new Enrollment(nextStudent, section));
                    return "Đã hủy học phần " + section.getCourse().getCode() + " cho sinh viên " + student.getStudentCode()
                            + ". Sinh viên tiếp theo trong danh sách chờ (" + nextStudent.getStudentCode() + ") đã được chuyển vào lớp.";
                }
            }
        }
        return "Đã hủy học phần " + section.getCourse().getCode() + " (" + section.getSectionCode() + ") cho sinh viên " + student.getStudentCode() + ".";
    }

    private String prerequisiteLabel(Course course){if(course.getPrerequisiteCodes().isEmpty())return "Không có";return course.getPrerequisiteCodes().stream().map(code->courses.findByCodeIgnoreCase(code).map(Course::getName).orElse(code)).sorted().reduce((a,b)->a+", "+b).orElse("Không có");}
    private boolean dependsOn(String courseCode,String target,Set<String> visited){
        if(!visited.add(courseCode))return false;
        Course node=courses.findByCodeIgnoreCase(courseCode).orElse(null);if(node==null)return false;
        for(String prerequisite:node.getPrerequisiteCodes())if(prerequisite.equalsIgnoreCase(target)||dependsOn(prerequisite,target,visited))return true;
        return false;
    }

    private Course course(String code){return courses.findByCodeIgnoreCase(code.trim()).orElseThrow(()->new IllegalArgumentException("Không tìm thấy môn học "+code+"."));}
    private Semester semester(String code){return semesters.findByCodeIgnoreCase(code.trim()).orElseThrow(()->new IllegalArgumentException("Không tìm thấy học kỳ "+code+"."));}
    private Lecturer lecturer(String code){return lecturers.findByLecturerCode(code.trim()).orElseThrow(()->new IllegalArgumentException("Không tìm thấy giảng viên "+code+"."));}
    private Curriculum curriculum(String code){return curricula.findByCodeIgnoreCase(code).orElseThrow(()->new IllegalArgumentException("Không tìm thấy khung chương trình."));}
    private String blank(String value){return value==null||value.isBlank()?"Không có":value.trim();}
    private String allowedUrl(String value){
        if(value==null||value.isBlank())return null;
        try{var uri=java.net.URI.create(value.trim());if(!("https".equalsIgnoreCase(uri.getScheme())||"http".equalsIgnoreCase(uri.getScheme()))||uri.getHost()==null)throw new IllegalArgumentException("Liên kết đề cương phải là URL http hoặc https hợp lệ.");return uri.toString();}
        catch(IllegalArgumentException exception){throw new IllegalArgumentException("Liên kết đề cương phải là URL http hoặc https hợp lệ.");}
    }
}
