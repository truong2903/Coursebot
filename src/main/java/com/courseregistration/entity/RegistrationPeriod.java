package com.courseregistration.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name="registration_periods",uniqueConstraints=@UniqueConstraint(columnNames={"semester_id"}))
public class RegistrationPeriod {
    public enum Status { SCHEDULED, OPEN, CLOSED, CANCELLED }
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional=false,fetch=FetchType.LAZY) private Semester semester;
    @Column(nullable=false) private LocalDateTime startsAt;
    @Column(nullable=false) private LocalDateTime endsAt;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) private Status status=Status.SCHEDULED;
    protected RegistrationPeriod(){}
    public RegistrationPeriod(Semester semester,LocalDateTime startsAt,LocalDateTime endsAt,Status status){this.semester=semester;this.startsAt=startsAt;this.endsAt=endsAt;this.status=status;}
    public Long getId(){return id;} public Semester getSemester(){return semester;} public LocalDateTime getStartsAt(){return startsAt;} public LocalDateTime getEndsAt(){return endsAt;} public Status getStatus(){return status;}
    public Status getEffectiveStatus(){
        if(status==Status.CANCELLED||status==Status.CLOSED)return status;
        LocalDateTime now=LocalDateTime.now();
        if(now.isBefore(startsAt))return Status.SCHEDULED;
        if(now.isAfter(endsAt))return Status.CLOSED;
        return Status.OPEN;
    }
    public void update(Semester semester,LocalDateTime startsAt,LocalDateTime endsAt,Status status){this.semester=semester;this.startsAt=startsAt;this.endsAt=endsAt;this.status=status;}
}
