package com.courseregistration.service;

import com.courseregistration.dto.*;
import com.courseregistration.entity.AcademicResult;
import com.courseregistration.entity.Course;
import com.courseregistration.entity.Curriculum;
import com.courseregistration.entity.Enrollment;
import com.courseregistration.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class StudentAcademicService {
    private final AuthService auth;
    private final CurriculumRepository curricula;
    private final CurriculumCourseRepository entries;
    private final EnrollmentRepository enrollments;
    private final SemesterRepository semesters;
    private final CourseService courses;
    private final AcademicResultRepository academicResults;
    private final CourseRepository courseCatalog;

    public StudentAcademicService(AuthService auth,
                                  CurriculumRepository curricula,
                                  CurriculumCourseRepository entries,
                                  EnrollmentRepository enrollments,
                                  SemesterRepository semesters,
                                  CourseService courses,
                                  AcademicResultRepository academicResults,
                                  CourseRepository courseCatalog) {
        this.auth = auth;
        this.curricula = curricula;
        this.entries = entries;
        this.enrollments = enrollments;
        this.semesters = semesters;
        this.courses = courses;
        this.academicResults = academicResults;
        this.courseCatalog = courseCatalog;
    }

    @Transactional(readOnly = true)
    public StudentCurriculumDto curriculum() {
        var student = auth.currentStudent();
        var options = curricula.findAllByProgramIgnoreCaseAndCohortIgnoreCaseAndStatusOrderByVersionDesc(
                student.getProgram(), student.getCohort(), Curriculum.Status.ACTIVE);
        Curriculum curriculum = options.stream().findFirst()
                .orElseThrow(() -> new IllegalStateException("Chưa có khung chương trình đang áp dụng cho ngành và khóa học của bạn."));
        return curriculum(curriculum.getCode());
    }

    @Transactional(readOnly = true)
    public List<CurriculumDto> activeCurricula() {
        return curricula.findAllByStatusOrderByProgramAscCohortAscVersionDesc(Curriculum.Status.ACTIVE)
                .stream().map(CurriculumDto::from).toList();
    }

    @Transactional(readOnly = true)
    public StudentScheduleDto schedule(String semesterCode) {
        var student = auth.currentStudent();
        var semester = semesterCode == null || semesterCode.isBlank()
                ? courses.currentSemester()
                : semesters.findByCodeIgnoreCase(semesterCode)
                        .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy học kỳ."));
        var rows = enrollments.findAllByStudentAndSection_Semester_CodeAndStatusOrderByEnrolledAtAsc(
                student, semester.getCode(), Enrollment.Status.ENROLLED);
        return new StudentScheduleDto(
                semester.getCode(),
                semester.getName(),
                semesters.findAllByOrderByStartsAtDesc().stream().map(SemesterManagementDto::from).toList(),
                rows.stream().map(item -> courses.toDto(item.getSection(), true)).toList());
    }

    @Transactional(readOnly = true)
    public StudentCurriculumDto curriculum(String code) {
        Curriculum selected = curricula.findByCodeIgnoreCase(code)
                .filter(c -> c.getStatus() == Curriculum.Status.ACTIVE)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy khung chương trình đang áp dụng."));
        return new StudentCurriculumDto(
                CurriculumDto.from(selected),
                entries.findAllByCurriculum_CodeOrderBySuggestedSemesterAscOrderIndexAsc(selected.getCode())
                        .stream().map(CurriculumCourseDto::from).toList());
    }

    @Transactional(readOnly = true)
    public StudentTranscriptDto transcript() {
        var student = auth.currentStudent();
        List<AcademicResult> records = academicResults.findTranscriptByStudentId(student.getId());

        Set<String> passedCodes = new LinkedHashSet<>(student.getCompletedCourseCodes());
        for (var r : records) {
            if (r.isPassed()) {
                passedCodes.add(r.getCourse().getCode());
            }
        }

        Map<String, Integer> creditsByCourse = new HashMap<>();
        for (var r : records) {
            creditsByCourse.put(r.getCourse().getCode(), r.getCourse().getCredits());
        }
        Set<String> missingCreditLookup = passedCodes.stream()
                .filter(code -> !creditsByCourse.containsKey(code))
                .collect(Collectors.toSet());
        if (!missingCreditLookup.isEmpty()) {
            for (Course c : courseCatalog.findAllByCodeIn(missingCreditLookup)) {
                creditsByCourse.put(c.getCode(), c.getCredits());
            }
        }

        int accumulatedCredits = passedCodes.stream()
                .mapToInt(code -> creditsByCourse.getOrDefault(code, 0))
                .sum();

        // Điểm trung bình tham khảo hệ 10 theo điểm cao nhất của từng mã môn có điểm số
        Map<String, AcademicResult> bestGradedByCourse = new LinkedHashMap<>();
        for (var r : records) {
            if (r.getGrade() != null && r.getCourse().getCredits() > 0) {
                bestGradedByCourse.merge(r.getCourse().getCode(), r,
                        (a, b) -> b.getGrade().compareTo(a.getGrade()) > 0 ? b : a);
            }
        }
        BigDecimal weightedSum = BigDecimal.ZERO;
        int gradedCredits = 0;
        for (var best : bestGradedByCourse.values()) {
            int cr = best.getCourse().getCredits();
            weightedSum = weightedSum.add(best.getGrade().multiply(BigDecimal.valueOf(cr)));
            gradedCredits += cr;
        }
        BigDecimal weightedAvg = gradedCredits > 0
                ? weightedSum.divide(BigDecimal.valueOf(gradedCredits), 2, RoundingMode.HALF_UP)
                : null;

        List<AcademicResultDto> dtos = records.stream()
                .map(r -> AcademicResultDto.from(r, r.isFailed() && passedCodes.contains(r.getCourse().getCode())))
                .toList();

        return new StudentTranscriptDto(
                student.getStudentCode(),
                student.getFullName(),
                student.getProgram(),
                student.getCohort(),
                records.size(),
                passedCodes.size(),
                accumulatedCredits,
                weightedAvg,
                dtos
        );
    }
}
