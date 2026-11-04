package com.courseregistration.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.Objects;

@Entity
@Table(
    name = "academic_results",
    uniqueConstraints = @UniqueConstraint(columnNames = {"student_id", "course_id", "semester_id"})
)
public class AcademicResult {
    public static final String OUTCOME_PASSED = "Đạt";
    public static final String OUTCOME_FAILED = "Chưa đạt";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Student student;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Course course;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Semester semester;

    @Column(nullable = false, length = 20)
    private String outcome;

    @Column(precision = 4, scale = 2)
    private BigDecimal grade;

    @Column(length = 10)
    private String letterGrade;

    protected AcademicResult() {}

    public AcademicResult(Student student, Course course, Semester semester,
                          String outcome, BigDecimal grade, String letterGrade) {
        this.student = Objects.requireNonNull(student, "Sinh viên không được để trống");
        this.course = Objects.requireNonNull(course, "Học phần không được để trống");
        this.semester = Objects.requireNonNull(semester, "Học kỳ không được để trống");
        this.outcome = Objects.requireNonNull(outcome, "Kết quả không được để trống").trim();
        this.grade = grade;
        this.letterGrade = letterGrade;
    }

    public Long getId() { return id; }
    public Student getStudent() { return student; }
    public Course getCourse() { return course; }
    public Semester getSemester() { return semester; }
    public String getOutcome() { return outcome; }
    public BigDecimal getGrade() { return grade; }
    public String getLetterGrade() { return letterGrade; }

    public boolean isPassed() {
        return OUTCOME_PASSED.equalsIgnoreCase(outcome);
    }

    public boolean isFailed() {
        return OUTCOME_FAILED.equalsIgnoreCase(outcome);
    }

    public boolean studiedBefore(Semester targetTerm) {
        if (targetTerm == null || semester == null) {
            return false;
        }
        if (semester.getCode() != null && semester.getCode().equalsIgnoreCase(targetTerm.getCode())) {
            return false;
        }
        if (targetTerm.getStartsAt() != null && semester.getStartsAt() != null) {
            return semester.getStartsAt().isBefore(targetTerm.getStartsAt());
        }
        return semester.getStatus() == Semester.Status.COMPLETED;
    }

    public String formatTranscriptLine() {
        return "• " + course.getCode() + " — " + course.getName()
                + " (" + semester.getCode() + "): " + outcome
                + (grade == null ? "; không có điểm số" : "; " + grade + "/10")
                + (letterGrade == null ? "" : "; " + letterGrade);
    }
}
