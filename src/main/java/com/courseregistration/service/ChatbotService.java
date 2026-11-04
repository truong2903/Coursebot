package com.courseregistration.service;

import com.courseregistration.dto.ChatRequest;
import com.courseregistration.dto.ChatResponse;
import com.courseregistration.entity.Student;
import com.courseregistration.service.chat.AiChatExchange;
import com.courseregistration.service.chat.AiProviderAdapter;
import com.courseregistration.service.chat.OpenAiCompatibleAiAdapter;
import com.courseregistration.service.chat.TeammateWebhookAiAdapter;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Locale;

/** Optional language-model presentation, always backed by a local verified answer. */
@Service
public class ChatbotService {
    private final AcademicChatService academic;
    private final AuthService auth;
    private final AiProviderAdapter adapter;

    @Autowired
    public ChatbotService(AcademicChatService academic,
                          AuthService auth,
                          RestClient.Builder builder,
                          @Value("${app.ai.provider:OPENAI_COMPATIBLE}") String provider,
                          @Value("${app.ai.api-url:https://api.openai.com/v1/chat/completions}") String apiUrl,
                          @Value("${app.ai.api-key:}") String apiKey,
                          @Value("${app.ai.model:gpt-4o-mini}") String model,
                          @Value("${app.ai.timeout-seconds:12}") int timeout) {
        this(academic, auth, buildAdapter(builder, provider, apiUrl, apiKey, model, timeout));
    }

    public ChatbotService(AcademicChatService academic,
                          RestClient.Builder builder,
                          String apiUrl,
                          String apiKey,
                          String model,
                          int timeout) {
        this(academic, null, buildAdapter(builder, "OPENAI_COMPATIBLE", apiUrl, apiKey, model, timeout));
    }

    public ChatbotService(AcademicChatService academic, AuthService auth, AiProviderAdapter adapter) {
        this.academic = academic;
        this.auth = auth;
        this.adapter = adapter;
    }

    public static AiProviderAdapter buildAdapter(RestClient.Builder builder,
                                                 String provider,
                                                 String apiUrl,
                                                 String apiKey,
                                                 String model,
                                                 int timeout) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(Math.max(1, Math.min(timeout, 30))));
        RestClient client = builder.requestFactory(factory).build();

        String normalized = provider == null ? "OPENAI_COMPATIBLE" : provider.trim().toUpperCase(Locale.ROOT);
        if ("CUSTOM_WEBHOOK".equals(normalized) || "TEAMMATE".equals(normalized) || "WEBHOOK".equals(normalized)) {
            return new TeammateWebhookAiAdapter(client, apiUrl, apiKey);
        }
        return new OpenAiCompatibleAiAdapter(client, normalized, apiUrl, apiKey, model);
    }

    public boolean aiConfigured() {
        return adapter.isConfigured();
    }

    public String providerName() {
        return adapter.isConfigured() ? adapter.providerName() : "LOCAL";
    }

    public ChatResponse respond(ChatRequest request) {
        var answer = academic.answer(request);
        if (!aiConfigured()) {
            return response(answer, false, "LOCAL", answer.reply());
        }
        try {
            Student student = null;
            if (auth != null) {
                try { student = auth.currentStudent(); } catch (Exception ignored) {}
            }
            var exchange = new AiChatExchange(
                    request.message(),
                    request.history(),
                    answer.reply(),
                    answer.sources(),
                    student == null ? null : student.getStudentCode(),
                    student == null ? null : student.getFullName(),
                    student == null ? null : student.getProgram(),
                    student == null ? null : student.getCohort()
            );
            String content = adapter.generateExplanation(exchange);
            return response(answer, true, "ONLINE", answer.reply() + "\n\nDiễn giải AI (tham khảo):\n" + content);
        } catch (Exception failure) {
            LoggerFactory.getLogger(ChatbotService.class)
                    .warn("EduPortal AI unavailable ({}); serving verified local answer ({})",
                            adapter.providerName(), failure.getClass().getSimpleName());
            return response(answer, false, "FALLBACK",
                    answer.reply() + "\n\nKết nối AI đang gián đoạn; câu trả lời trên được tra cứu trực tiếp từ dữ liệu học vụ.");
        }
    }

    private ChatResponse response(AcademicChatService.Answer answer, boolean online, String mode, String reply) {
        return new ChatResponse(reply, online, mode, answer.sources(), answer.suggestions());
    }
}
