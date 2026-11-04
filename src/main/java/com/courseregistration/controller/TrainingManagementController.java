package com.courseregistration.controller;

import com.courseregistration.dto.*;
import com.courseregistration.entity.Enrollment;
import com.courseregistration.service.TrainingManagementService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/training")
public class TrainingManagementController {
    private final TrainingManagementService service;
    public TrainingManagementController(TrainingManagementService service) { this.service = service; }

    @GetMapping("/courses") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_READ')")
    public List<CourseManagementDto> courses() { return service.listCourses(); }
    @PostMapping("/courses") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public CourseManagementDto createCourse(@Valid @RequestBody CourseManagementRequest r) { return service.createCourse(r); }
    @PutMapping("/courses/{code}") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public CourseManagementDto updateCourse(@PathVariable String code, @Valid @RequestBody CourseManagementRequest r) { return service.updateCourse(code, r); }
    @DeleteMapping("/courses/{code}") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public ActionResponse archiveCourse(@PathVariable String code) { service.archiveCourse(code); return new ActionResponse(true, "Môn học đã được chuyển sang trạng thái ngừng sử dụng."); }

    @GetMapping("/semesters") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_READ')")
    public List<SemesterManagementDto> semesters() { return service.listSemesters(); }
    @PostMapping("/semesters") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public SemesterManagementDto createSemester(@Valid @RequestBody SemesterManagementRequest r) { return service.createSemester(r); }
    @PutMapping("/semesters/{id}") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public SemesterManagementDto updateSemester(@PathVariable Long id, @Valid @RequestBody SemesterManagementRequest r) { return service.updateSemester(id, r); }
    @DeleteMapping("/semesters/{id}") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public ActionResponse archiveSemester(@PathVariable Long id) { service.archiveSemester(id); return new ActionResponse(true, "Học kỳ đã được lưu trữ."); }

    @GetMapping("/sections") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_READ')")
    public List<SectionManagementDto> sections() { return service.listSections(); }
    @PostMapping("/sections") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public SectionManagementDto createSection(@Valid @RequestBody SectionManagementRequest r) { return service.createSection(r); }
    @PutMapping("/sections/{id}") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public SectionManagementDto updateSection(@PathVariable String id, @Valid @RequestBody SectionManagementRequest r) { return service.updateSection(id, r); }
    @DeleteMapping("/sections/{id}") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public ActionResponse cancelSection(@PathVariable String id) { service.cancelSection(id); return new ActionResponse(true, "Lớp học phần đã được hủy; lịch sử đăng ký được giữ lại."); }

    @GetMapping("/registration-periods") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_READ')")
    public List<RegistrationPeriodDto> periods() { return service.listPeriods(); }
    @PostMapping("/registration-periods") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public RegistrationPeriodDto createPeriod(@Valid @RequestBody RegistrationPeriodRequest r) { return service.createPeriod(r); }
    @PutMapping("/registration-periods/{id}") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public RegistrationPeriodDto updatePeriod(@PathVariable Long id, @Valid @RequestBody RegistrationPeriodRequest r) { return service.updatePeriod(id, r); }
    @DeleteMapping("/registration-periods/{id}") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public ActionResponse cancelPeriod(@PathVariable Long id) { service.cancelPeriod(id); return new ActionResponse(true, "Đợt đăng ký đã được hủy."); }

    @GetMapping("/curricula") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_READ')")
    public List<CurriculumDto> curricula() { return service.listCurricula(); }
    @PostMapping("/curricula") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public CurriculumDto createCurriculum(@Valid @RequestBody CurriculumRequest r) { return service.createCurriculum(r); }
    @PutMapping("/curricula/{id}") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public CurriculumDto updateCurriculum(@PathVariable Long id, @Valid @RequestBody CurriculumRequest r) { return service.updateCurriculum(id, r); }
    @DeleteMapping("/curricula/{id}") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public ActionResponse archiveCurriculum(@PathVariable Long id) { service.archiveCurriculum(id); return new ActionResponse(true, "Khung chương trình đã được lưu trữ."); }
    @GetMapping("/curricula/{code}/courses") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_READ')")
    public List<CurriculumCourseDto> curriculumCourses(@PathVariable String code) { return service.listCurriculumCourses(code); }
    @PostMapping("/curricula/{code}/courses") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public CurriculumCourseDto addCurriculumCourse(@PathVariable String code, @Valid @RequestBody CurriculumCourseRequest r) { return service.addCurriculumCourse(code, r); }
    @PutMapping("/curricula/{code}/courses/{courseCode}") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public CurriculumCourseDto updateCurriculumCourse(@PathVariable String code, @PathVariable String courseCode, @Valid @RequestBody CurriculumCourseRequest r) { return service.updateCurriculumCourse(code, courseCode, r); }
    @DeleteMapping("/curricula/{code}/courses/{courseCode}") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public ActionResponse removeCurriculumCourse(@PathVariable String code, @PathVariable String courseCode) { service.removeCurriculumCourse(code, courseCode); return new ActionResponse(true, "Đã gỡ môn học khỏi khung chương trình."); }

    @GetMapping("/prerequisites") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_READ')")
    public List<PrerequisiteDto> prerequisites() { return service.listPrerequisites(); }
    @PostMapping("/prerequisites") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public PrerequisiteDto addPrerequisite(@RequestBody MapRequest r) { return service.addPrerequisite(r.courseCode(), r.prerequisiteCode()); }
    @PutMapping("/prerequisites/{key}") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public PrerequisiteDto updatePrerequisite(@PathVariable String key, @RequestBody MapRequest r) { return service.updatePrerequisite(key, r.courseCode(), r.prerequisiteCode()); }
    @DeleteMapping("/prerequisites/{key}") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public ActionResponse deletePrerequisite(@PathVariable String key) { String[] p = splitKey(key); service.deletePrerequisite(p[0], p[1]); return new ActionResponse(true, "Đã gỡ điều kiện tiên quyết."); }

    @GetMapping("/enrollments") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_READ')")
    public List<EnrollmentAdminDto> enrollments(@RequestParam(required = false) String semester,
                                                @RequestParam(required = false) Enrollment.Status status,
                                                @RequestParam(required = false) String q) {
        return service.listEnrollments(semester, status, q);
    }

    @PostMapping("/enrollments/{id}/approve") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public ActionResponse approveEnrollment(@PathVariable Long id) {
        return new ActionResponse(true, service.approvePendingEnrollment(id));
    }

    @PostMapping("/enrollments/{id}/reject") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public ActionResponse rejectEnrollment(@PathVariable Long id,
                                           @Valid @RequestBody(required = false) EnrollmentActionRequest request) {
        return new ActionResponse(true, service.rejectPendingEnrollment(id, request == null ? null : request.reason()));
    }

    @PostMapping("/enrollments/{id}/admin-drop") @PreAuthorize("@accessPolicy.has(authentication, 'TRAINING_MANAGE')")
    public ActionResponse adminDropEnrollment(@PathVariable Long id,
                                              @Valid @RequestBody(required = false) EnrollmentActionRequest request) {
        return new ActionResponse(true, service.adminDropEnrollment(id, request == null ? null : request.reason()));
    }

    public record MapRequest(String courseCode, String prerequisiteCode) {}
    private String[] splitKey(String key) { String[] parts = key.split("~", 2); if (parts.length != 2) throw new IllegalArgumentException("Mã quan hệ tiên quyết không hợp lệ."); return parts; }
}
