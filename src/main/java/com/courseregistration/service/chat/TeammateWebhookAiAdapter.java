package com.courseregistration.service.chat;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Adapter kết nối trực tiếp tới dịch vụ Chatbot AI riêng của thành viên trong nhóm
 * (ví dụ server Python FastAPI / Flask / LangChain / Node.js / Rasa).
 * Hỗ trợ đọc linh hoạt các trường JSON phổ biến: reply, answer, response, output, message hoặc chuẩn OpenAI choices.
 */
public class TeammateWebhookAiAdapter implements AiProviderAdapter {
    private final RestClient client;
    private final String webhookUrl;
    private final String optionalToken;

    public TeammateWebhookAiAdapter(RestClient client, String webhookUrl, String optionalToken) {
        this.client = client;
        this.webhookUrl = webhookUrl == null ? "" : webhookUrl.trim();
        this.optionalToken = optionalToken == null ? "" : optionalToken.trim();
    }

    @Override
    public String providerName() {
        return "CUSTOM_WEBHOOK";
    }

    @Override
    public boolean isConfigured() {
        return !webhookUrl.isBlank()
                && !OpenAiCompatibleAiAdapter.OPENAI_DEFAULT_URL.equalsIgnoreCase(webhookUrl);
    }

    @Override
    public String generateExplanation(AiChatExchange exchange) {
        Map<String, Object> studentInfo = new LinkedHashMap<>();
        if (exchange.studentCode() != null) studentInfo.put("studentCode", exchange.studentCode());
        if (exchange.studentName() != null) studentInfo.put("fullName", exchange.studentName());
        if (exchange.program() != null) studentInfo.put("program", exchange.program());
        if (exchange.cohort() != null) studentInfo.put("cohort", exchange.cohort());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("message", exchange.userMessage());
        payload.put("history", exchange.history() == null ? List.of() : exchange.history());
        payload.put("verifiedContext", exchange.verifiedReply());
        payload.put("sources", exchange.sources() == null ? List.of() : exchange.sources());
        payload.put("student", studentInfo);

        var spec = client.post()
                .uri(webhookUrl)
                .contentType(MediaType.APPLICATION_JSON);
        if (!optionalToken.isBlank()) {
            spec = spec.headers(h -> h.setBearerAuth(optionalToken));
        }
        Map<String, Object> result = spec.body(payload)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
        String content = extractReplyText(result);
        if (content == null || content.isBlank() || content.length() > 12000) {
            throw new IllegalStateException("Invalid custom chatbot response");
        }
        return content.trim();
    }

    private static String extractReplyText(Map<String, Object> body) {
        if (body == null) {
            return null;
        }
        for (String key : List.of("reply", "answer", "response", "output", "content", "text", "message")) {
            Object val = body.get(key);
            if (val instanceof String s && !s.isBlank()) {
                return s;
            }
        }
        if (body.get("choices") instanceof List<?> choices
                && !choices.isEmpty()
                && choices.getFirst() instanceof Map<?, ?> choice
                && choice.get("message") instanceof Map<?, ?> msg
                && msg.get("content") instanceof String content) {
            return content;
        }
        return null;
    }
}
