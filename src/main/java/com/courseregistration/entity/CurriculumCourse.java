package com.courseregistration.entity;

import jakarta.persistence.*;

@Entity
@Table(name="curriculum_courses",uniqueConstraints=@UniqueConstraint(columnNames={"curriculum_id","course_id"}))
public class CurriculumCourse {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional=false,fetch=FetchType.LAZY) private Curriculum curriculum;
    @ManyToOne(optional=false,fetch=FetchType.LAZY) private Course course;
    @Column(nullable=false,length=40) private String suggestedSemester;
    @Column(nullable=false) private boolean requiredCourse;
    @Column(nullable=false) private int orderIndex;
    protected CurriculumCourse(){}
    public CurriculumCourse(Curriculum curriculum,Course course,String suggestedSemester,boolean requiredCourse,int orderIndex){this.curriculum=curriculum;this.course=course;this.suggestedSemester=suggestedSemester;this.requiredCourse=requiredCourse;this.orderIndex=orderIndex;}
    public Long getId(){return id;}public Curriculum getCurriculum(){return curriculum;}public Course getCourse(){return course;}public String getSuggestedSemester(){return suggestedSemester;}public boolean isRequiredCourse(){return requiredCourse;}public int getOrderIndex(){return orderIndex;}
    public void update(String suggestedSemester,boolean requiredCourse,int orderIndex){this.suggestedSemester=suggestedSemester;this.requiredCourse=requiredCourse;this.orderIndex=orderIndex;}
}
