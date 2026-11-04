package com.courseregistration.dto;

import com.courseregistration.entity.UserAccount;

public record AccountManagementDto(Long id, String username, String role, String status, String email,
                                   String studentCode, String lecturerCode, String displayName,
                                   String program, String cohort, String department) {
    public static AccountManagementDto from(UserAccount account, String displayName, String program,String cohort, String department) {
        return new AccountManagementDto(account.getId(), account.getUsername(), account.getRole().name(),
                account.getStatus().name(), account.getEmail(), account.getStudentCode(), account.getLecturerCode(),
                displayName, program, cohort, department);
    }
}
