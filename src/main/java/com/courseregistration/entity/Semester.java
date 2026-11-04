package com.courseregistration.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "semesters")
public class Semester {
    public enum Status { PLANNED, ACTIVE, COMPLETED, ARCHIVED }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 30)
    private String code;
    @Column(nullable = false, length = 100)
    private String name;
    private LocalDate startsAt;
    private LocalDate endsAt;
    @Column(length=20) private String academicYear;
    private Integer termNumber;
    private LocalDate weekOneStartsAt;
    private Integer teachingWeeks;
    private LocalDate registrationOpenAt;
    private LocalDate registrationCloseAt;
    @Enumerated(EnumType.STRING) @Column(nullable = true, length = 20)
    private Status status = Status.PLANNED;
    @Column(nullable=false,columnDefinition="boolean default false")
    private boolean registrationAlwaysOpen;

    protected Semester() {}
    public Semester(String code, String name, LocalDate startsAt, LocalDate registrationOpenAt, LocalDate registrationCloseAt) {
        this.code = code; this.name = name; this.startsAt = startsAt;
        this.registrationOpenAt = registrationOpenAt; this.registrationCloseAt = registrationCloseAt;
    }
    public Long getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public LocalDate getStartsAt() { return startsAt; }
    public LocalDate getEndsAt() { return endsAt; }
    public String getAcademicYear() { return academicYear; }
    public Integer getTermNumber() { return termNumber; }
    public LocalDate getWeekOneStartsAt() { return weekOneStartsAt; }
    public Integer getTeachingWeeks() { return teachingWeeks; }
    public LocalDate getRegistrationOpenAt() { return registrationOpenAt; }
    public LocalDate getRegistrationCloseAt() { return registrationCloseAt; }
    public Status getStatus() { return status; }
    public boolean isRegistrationAlwaysOpen(){return registrationAlwaysOpen;}
    public void setRegistrationAlwaysOpen(boolean value){registrationAlwaysOpen=value;}
    public void setWeekCalendar(String academicYear, Integer termNumber, LocalDate weekOneStartsAt, Integer teachingWeeks) {
        this.academicYear = academicYear;
        this.termNumber = termNumber;
        this.weekOneStartsAt = weekOneStartsAt;
        this.teachingWeeks = teachingWeeks;
    }
    public java.util.OptionalInt teachingWeekOf(LocalDate date) {
        if (date == null || weekOneStartsAt == null) return java.util.OptionalInt.empty();
        long elapsed = java.time.temporal.ChronoUnit.DAYS.between(weekOneStartsAt, date);
        if (elapsed < 0) return java.util.OptionalInt.empty();
        long week = elapsed / 7 + 1;
        if (teachingWeeks != null && week > teachingWeeks) return java.util.OptionalInt.empty();
        return java.util.OptionalInt.of((int) week);
    }
    public void setDates(LocalDate startsAt, LocalDate openAt, LocalDate closeAt) {
        this.startsAt = startsAt; this.registrationOpenAt = openAt; this.registrationCloseAt = closeAt;
    }
    public void update(String name, LocalDate startsAt, LocalDate endsAt, LocalDate openAt, LocalDate closeAt, Status status) {
        this.name=name; this.startsAt=startsAt; this.endsAt=endsAt; this.registrationOpenAt=openAt;
        this.registrationCloseAt=closeAt; this.status=status;
    }
}
