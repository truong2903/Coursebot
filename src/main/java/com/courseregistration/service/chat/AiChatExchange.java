package com.courseregistration.service.chat;

import com.courseregistration.dto.ChatHistoryMessage;
import java.util.List;

/**
 * Dữ liệu trao đổi chuẩn hóa gửi sang tầng AI bên ngoài (Gemini/Groq/OpenAI hoặc Chatbot Server của thành viên nhóm).
 */
public record AiChatExchange(
        String userMessage,
        List<ChatHistoryMessage> history,
        String verifiedReply,
        List<String> sources,
        String studentCode,
        String studentName,
        String program,
        String cohort
) {}
