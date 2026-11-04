package com.courseregistration.entity;

import jakarta.persistence.*;
import java.util.*;
import java.util.stream.Collectors;

@Entity
@Table(name = "course_sections")
public class CourseSection {
    public enum Status { OPEN, CLOSED, CANCELLED }
    @Id
    @Column(length = 40)
    private String id;
    @Column(nullable = false, length = 30)
    private String sectionCode;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Course course;
    @ManyToOne(fetch = FetchType.LAZY)
    private Lecturer lecturer;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Semester semester;
    @Column(nullable = false, length = 100)
    private String schedule;
    @Column(nullable = false, length = 40)
    private String room;
    @Column(nullable = false)
    private int capacity;
    @Column(nullable = false, length = 20)
    private String color;
    @Enumerated(EnumType.STRING) @Column(nullable=true,length=20)
    private Status status = Status.OPEN;
    @OneToMany(mappedBy = "section", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<SectionMeeting> meetings = new ArrayList<>();
    private Integer importedEnrolled;
    @Column(length=80) private String sourceStatus;
    @Column(length=40) private String sectionType;
    @Column(length=40) private String linkedSectionCode;
    @Column(length=120) private String sourceImportKey;
    @Column(nullable=false,columnDefinition="boolean default false")
    private boolean scheduleReviewRequired;

    protected CourseSection() {}
    public CourseSection(String id, String sectionCode, Course course, Lecturer lecturer, Semester semester,
                         String schedule, String room, int capacity, String color) {
        this.id = id; this.sectionCode = sectionCode; this.course = course; this.lecturer = lecturer;
        this.semester = semester; this.schedule = schedule; this.room = room; this.capacity = capacity; this.color = color;
    }
    public String getId() { return id; }
    public String getSectionCode() { return sectionCode; }
    public Course getCourse() { return course; }
    public Lecturer getLecturer() { return lecturer; }
    public Semester getSemester() { return semester; }
    public String getSchedule() { return meetings.isEmpty()?schedule:meetings.stream().map(SectionMeeting::summary).collect(Collectors.joining("; ")); }
    public String getRoom() { String value=meetings.isEmpty()?room:meetings.stream().map(SectionMeeting::getRoom).filter(Objects::nonNull).distinct().collect(Collectors.joining(", "));return value==null||value.isBlank()?"Chưa có phòng":value; }
    public String getLecturerName(){return lecturer==null?"Chưa phân công":lecturer.getFullName();}
    public String getLecturerCode(){return lecturer==null?null:lecturer.getLecturerCode();}
    public List<SectionMeeting> getEffectiveMeetings(){return meetings.isEmpty()?List.of(SectionMeeting.legacy(schedule,room)):List.copyOf(meetings);}
    public void replaceMeetings(List<SectionMeeting> values){meetings.clear();values.forEach(m->{m.setSection(this);meetings.add(m);});scheduleReviewRequired=false;}
    public int totalEnrolled(long local){return Math.toIntExact((importedEnrolled==null?0:importedEnrolled)+local);}
    public Integer getImportedEnrolled(){return importedEnrolled;}
    public void setImportedEnrolled(Integer value){importedEnrolled=value;}
    public String getSourceStatus(){return sourceStatus;}
    public String getSectionType(){return sectionType;}
    public String getLinkedSectionCode(){return linkedSectionCode;}
    public boolean isScheduleReviewRequired(){return scheduleReviewRequired||(sourceImportKey!=null&&importedEnrolled==null);}
    public int getCapacity() { return capacity; }
    public String getColor() { return color; }
    public Status getStatus(){return status;}
    public void update(Course course,Lecturer lecturer,Semester semester,String sectionCode,String schedule,String room,int capacity) {
        this.course=course;this.lecturer=lecturer;this.semester=semester;this.sectionCode=sectionCode;
        this.schedule=schedule;this.room=room;this.capacity=capacity;
    }
    public void setStatus(Status status){this.status=status;}
}
