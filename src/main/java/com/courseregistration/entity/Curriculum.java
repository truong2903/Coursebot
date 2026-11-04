package com.courseregistration.entity;

import jakarta.persistence.*;

@Entity
@Table(name="curricula")
public class Curriculum {
    public enum Status { DRAFT, ACTIVE, ARCHIVED }
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false,unique=true,length=40) private String code;
    @Column(nullable=false,length=160) private String name;
    @Column(nullable=false,length=120) private String program;
    @Column(nullable=false,length=20) private String cohort;
    @Column(nullable=false,length=40) private String version;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) private Status status=Status.DRAFT;
    protected Curriculum(){}
    public Curriculum(String code,String name,String program,String cohort,String version,Status status){this.code=code;this.name=name;this.program=program;this.cohort=cohort;this.version=version;this.status=status;}
    public Long getId(){return id;}public String getCode(){return code;}public String getName(){return name;}public String getProgram(){return program;}public String getCohort(){return cohort;}public String getVersion(){return version;}public Status getStatus(){return status;}
    public void update(String name,String program,String cohort,String version,Status status){this.name=name;this.program=program;this.cohort=cohort;this.version=version;this.status=status;}
}
