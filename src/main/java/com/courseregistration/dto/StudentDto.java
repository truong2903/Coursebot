package com.courseregistration.dto;

import com.courseregistration.entity.Student;

public record StudentDto(String name, String id, String program, String semester) {
    public static StudentDto from(Student student, String semester) {
        return new StudentDto(student.getFullName(), student.getStudentCode(), student.getProgram(), semester);
    }
}
