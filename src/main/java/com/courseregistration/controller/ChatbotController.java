package com.courseregistration.controller;

import com.courseregistration.dto.ChatRequest;
import com.courseregistration.dto.ChatResponse;
import com.courseregistration.service.ChatbotService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayDeque;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatbotController {
    private final ChatbotService chatbotService;
    public ChatbotController(ChatbotService chatbotService) { this.chatbotService = chatbotService; }

    @PostMapping
    @PreAuthorize("@accessPolicy.has(authentication, 'STUDENT_ACADEMIC')")
    public ChatResponse chat(@Valid @RequestBody ChatRequest request, HttpSession session) {
        synchronized (session) {
            @SuppressWarnings("unchecked")
            ArrayDeque<Long> times = (ArrayDeque<Long>) session.getAttribute("academicChatRequests");
            if (times == null) times = new ArrayDeque<>();
            long now = System.currentTimeMillis();
            while (!times.isEmpty() && times.peekFirst() <= now - 60_000) times.removeFirst();
            if (times.size() >= 20)
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Bạn đã gửi nhiều câu hỏi. Vui lòng chờ một phút rồi thử lại.");
            times.addLast(now);
            session.setAttribute("academicChatRequests", times);
        }
        return chatbotService.respond(request);
    }

    @GetMapping("/status")
    @PreAuthorize("@accessPolicy.has(authentication, 'STUDENT_ACADEMIC')")
    public Map<String, Object> status() {
        boolean online = chatbotService.aiConfigured();
        return Map.of(
                "aiConfigured", online,
                "mode", online ? "ONLINE" : "LOCAL",
                "provider", chatbotService.providerName(),
                "message", online
                        ? "Đã kết nối AI (" + chatbotService.providerName() + "); dữ liệu học vụ được đối chiếu trước mỗi câu trả lời."
                        : "Tra cứu học vụ tại hệ thống, chưa bật dịch vụ AI bên ngoài."
        );
    }
}
