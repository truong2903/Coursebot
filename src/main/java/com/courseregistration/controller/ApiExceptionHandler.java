package com.courseregistration.controller;

import com.courseregistration.dto.ActionResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.security.core.AuthenticationException;
import com.courseregistration.service.AuditService;

@RestControllerAdvice
public class ApiExceptionHandler {
    private final AuditService audit;
    public ApiExceptionHandler(AuditService audit){this.audit=audit;}

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ActionResponse> authentication(AuthenticationException exception) {
        audit.record("LOGIN_FAILED","unknown","Thông tin xác thực không hợp lệ");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ActionResponse(false, "Tên đăng nhập hoặc mật khẩu không đúng."));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ActionResponse> badRequest(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new ActionResponse(false, exception.getMessage()));
    }

    // Preserve the Vietnamese explanation for explicit HTTP errors such as chat throttling.
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<ActionResponse> httpError(org.springframework.web.server.ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(new ActionResponse(false,exception.getReason()==null?"Không thể thực hiện yêu cầu.":exception.getReason()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ActionResponse> conflict(IllegalStateException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ActionResponse(false, exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ActionResponse> invalidRequest(MethodArgumentNotValidException exception) {
        return ResponseEntity.badRequest().body(new ActionResponse(false, "Vui lòng nhập đầy đủ thông tin hợp lệ."));
    }
}
