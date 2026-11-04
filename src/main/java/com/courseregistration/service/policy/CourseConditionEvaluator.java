package com.courseregistration.service.policy;

import com.courseregistration.entity.Course;
import com.courseregistration.entity.CourseCondition;
import com.courseregistration.entity.CourseSection;
import com.courseregistration.entity.Semester;
import com.courseregistration.entity.Student;
import com.courseregistration.repository.AcademicResultRepository;
import com.courseregistration.repository.CourseConditionRepository;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Bộ đánh giá tập trung (Single Source of Truth) cho cả 3 loại điều kiện học phần:
 * Tiên quyết, Học trước, Song hành — dùng thống nhất cho Đăng ký, Danh sách chờ, Hủy môn, Danh sách lớp và Chatbot.
 */
@Component
public class CourseConditionEvaluator {
    public record UnmetCondition(String conditionType, String requiredCourseCode, boolean fromPrerequisiteSet) {}

    private final CourseConditionRepository courseConditions;
    private final AcademicResultRepository academicResults;

    public CourseConditionEvaluator(CourseConditionRepository courseConditions,
                                    AcademicResultRepository academicResults) {
        this.courseConditions = courseConditions;
        this.academicResults = academicResults;
    }

    public Map<String, List<CourseConditionRepository.RuleView>> allRulesByCourse() {
        return courseConditions.findAllRuleViews().stream()
                .collect(Collectors.groupingBy(CourseConditionRepository.RuleView::courseCode));
    }

    public Set<String> priorStudiedCodes(Student student, Semester targetTerm) {
        Set<String> studied = new HashSet<>(student.getCompletedCourseCodes());
        if (student.getId() != null) {
            for (var result : academicResults.findTranscriptByStudentId(student.getId())) {
                if (result.studiedBefore(targetTerm)) {
                    studied.add(result.getCourse().getCode());
                }
            }
        }
        return studied;
    }

    public List<UnmetCondition> findUnmetConditions(Course course,
                                                    Student student,
                                                    Semester targetTerm,
                                                    Collection<String> activeCourseCodesInTerm) {
        var rules = courseConditions.findRuleViewsByCourseCode(course.getCode());
        var studied = priorStudiedCodes(student, targetTerm);
        return evaluateRules(course, student.getCompletedCourseCodes(), studied,
                new HashSet<>(activeCourseCodesInTerm), rules, true);
    }

    public List<UnmetCondition> findUnmetConditions(Course course,
                                                    Student student,
                                                    Collection<String> activeCourseCodesInTerm,
                                                    Map<String, List<CourseConditionRepository.RuleView>> rulesByCourse,
                                                    Set<String> priorStudiedCodes) {
        return evaluateRules(course, student.getCompletedCourseCodes(), priorStudiedCodes,
                new HashSet<>(activeCourseCodesInTerm),
                rulesByCourse.getOrDefault(course.getCode(), List.of()), true);
    }

    public List<UnmetCondition> findUnmetRuleConditionsOnly(Course course,
                                                            Student student,
                                                            Semester targetTerm,
                                                            Collection<String> activeCourseCodesInTerm) {
        var rules = courseConditions.findRuleViewsByCourseCode(course.getCode());
        if (rules.isEmpty()) {
            return List.of();
        }
        var studied = priorStudiedCodes(student, targetTerm);
        return evaluateRules(course, student.getCompletedCourseCodes(), studied,
                new HashSet<>(activeCourseCodesInTerm), rules, false);
    }

    private List<UnmetCondition> evaluateRules(Course course,
                                              Set<String> completedCodes,
                                              Set<String> priorStudiedCodes,
                                              Set<String> concurrentCodes,
                                              List<CourseConditionRepository.RuleView> rules,
                                              boolean includeCoursePrerequisiteSet) {
        List<UnmetCondition> unmet = new ArrayList<>();
        if (includeCoursePrerequisiteSet) {
            for (String code : course.getPrerequisiteCodes()) {
                if (!completedCodes.contains(code)) {
                    unmet.add(new UnmetCondition(CourseCondition.TYPE_PREREQUISITE, code, true));
                }
            }
        }
        for (var rule : rules) {
            if (!rule.isSatisfiedBy(completedCodes, priorStudiedCodes, concurrentCodes)) {
                boolean alreadyCovered = CourseCondition.TYPE_PREREQUISITE.equals(rule.conditionType())
                        && course.getPrerequisiteCodes().contains(rule.requiredCourseCode());
                if (!alreadyCovered) {
                    unmet.add(new UnmetCondition(rule.conditionType(), rule.requiredCourseCode(), false));
                }
            }
        }
        return unmet;
    }

    public Optional<String> formatViolationMessage(Course course, List<UnmetCondition> unmet) {
        if (unmet.isEmpty()) {
            return Optional.empty();
        }
        List<String> prereqs = new ArrayList<>();
        List<String> priorStudy = new ArrayList<>();
        List<String> coreqs = new ArrayList<>();
        List<String> others = new ArrayList<>();

        for (var item : unmet) {
            switch (item.conditionType()) {
                case CourseCondition.TYPE_PREREQUISITE -> prereqs.add(item.requiredCourseCode());
                case CourseCondition.TYPE_PRIOR_STUDY -> priorStudy.add(item.requiredCourseCode());
                case CourseCondition.TYPE_COREQUISITE -> coreqs.add(item.requiredCourseCode());
                default -> others.add(item.conditionType() + ": " + item.requiredCourseCode());
            }
        }

        List<String> parts = new ArrayList<>();
        if (!prereqs.isEmpty()) {
            boolean onlyLegacyPrereq = priorStudy.isEmpty() && coreqs.isEmpty() && others.isEmpty()
                    && course != null && course.getPrerequisite() != null && !course.getPrerequisite().isBlank()
                    && !course.getPrerequisite().contains(CourseCondition.TYPE_PRIOR_STUDY)
                    && !course.getPrerequisite().contains(CourseCondition.TYPE_COREQUISITE);
            String label = onlyLegacyPrereq ? course.getPrerequisite() : String.join(", ", prereqs);
            parts.add("Bạn chưa hoàn thành môn tiên quyết: " + label + ".");
        }
        if (!priorStudy.isEmpty()) {
            parts.add("Bạn chưa đáp ứng điều kiện học trước: " + String.join(", ", priorStudy) + " (cần đã học ở học kỳ trước).");
        }
        if (!coreqs.isEmpty()) {
            parts.add("Bạn chưa đáp ứng điều kiện song hành: " + String.join(", ", coreqs) + " (cần đã đạt hoặc đang đăng ký trong cùng học kỳ).");
        }
        if (!others.isEmpty()) {
            parts.add("Bạn chưa đáp ứng điều kiện học phần: " + String.join(", ", others) + ".");
        }
        return Optional.of(String.join(" ", parts));
    }

    public String shortBadgeLabel(List<UnmetCondition> unmet) {
        if (unmet.isEmpty()) {
            return null;
        }
        Set<String> types = unmet.stream().map(UnmetCondition::conditionType).collect(Collectors.toSet());
        if (types.size() > 1) {
            return "Thiếu điều kiện";
        }
        String single = types.iterator().next();
        return switch (single) {
            case CourseCondition.TYPE_PREREQUISITE -> "Thiếu tiên quyết";
            case CourseCondition.TYPE_PRIOR_STUDY -> "Thiếu học trước";
            case CourseCondition.TYPE_COREQUISITE -> "Thiếu song hành";
            default -> "Thiếu điều kiện";
        };
    }

    public List<String> formatChatProblems(List<UnmetCondition> unmet) {
        return unmet.stream()
                .map(item -> item.fromPrerequisiteSet()
                        ? "chưa đạt tiên quyết " + item.requiredCourseCode()
                        : item.conditionType() + " " + item.requiredCourseCode())
                .toList();
    }

    public Optional<String> checkCorequisiteDropViolation(Student student,
                                                          CourseSection sectionToDrop,
                                                          Collection<CourseSection> activeSectionsInSemester) {
        String droppedCode = sectionToDrop.getCourse().getCode();
        if (student.getCompletedCourseCodes().contains(droppedCode)) {
            return Optional.empty();
        }
        Set<String> remainingCourseCodes = activeSectionsInSemester.stream()
                .filter(s -> !s.getId().equals(sectionToDrop.getId()))
                .map(s -> s.getCourse().getCode())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (remainingCourseCodes.isEmpty() || remainingCourseCodes.contains(droppedCode)) {
            return Optional.empty();
        }
        var dependents = courseConditions.findCorequisiteDependents(droppedCode, remainingCourseCodes).stream()
                .map(CourseConditionRepository.RuleView::courseCode)
                .distinct()
                .toList();
        if (dependents.isEmpty()) {
            return Optional.empty();
        }
        String dependentList = String.join(", ", dependents);
        return Optional.of("Không thể hủy " + droppedCode + " vì môn đang đăng ký " + dependentList
                + " yêu cầu học song hành với môn này. Vui lòng hủy " + dependentList + " trước.");
    }
}
