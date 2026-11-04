package com.courseregistration.dto;

import com.courseregistration.entity.UserAccount;
import java.util.List;

public record AccountSessionDto(String username, String role, String displayName, String userCode, String semester, List<String> permissions) {
    public static AccountSessionDto from(UserAccount account, String displayName, String userCode, String semester, List<String> permissions) {
        return new AccountSessionDto(account.getUsername(), account.getRole().name(), displayName, userCode, semester, permissions);
    }
}
