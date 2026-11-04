package com.courseregistration;

import com.courseregistration.config.DotEnvEnvironmentPostProcessor;
import com.courseregistration.dto.ChatHistoryMessage;
import com.courseregistration.dto.ChatRequest;
import com.courseregistration.entity.PasswordResetToken;
import com.courseregistration.entity.Student;
import com.courseregistration.entity.UserAccount;
import com.courseregistration.repository.PasswordResetTokenRepository;
import com.courseregistration.repository.UserAccountRepository;
import com.courseregistration.service.AcademicChatService;
import com.courseregistration.service.AuthService;
import com.courseregistration.service.ChatbotService;
import com.courseregistration.service.PasswordResetService;
import com.courseregistration.service.chat.OpenAiCompatibleAiAdapter;
import com.sun.net.httpserver.HttpServer;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.client.RestClient;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Properties;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AiAdapterAndOtpConfigTest {

    @Test
    void teammateWebhookAdapterSendsVerifiedContextAndParsesCustomJsonWithoutApiKey() throws Exception {
        var academic = mock(AcademicChatService.class);
        var auth = mock(AuthService.class);
        var student = mock(Student.class);
        when(student.getStudentCode()).thenReturn("B23DCCN001");
        when(student.getFullName()).thenReturn("Nguyễn Văn An");
        when(student.getProgram()).thenReturn("Công nghệ thông tin");
        when(student.getCohort()).thenReturn("D23");
        when(auth.currentStudent()).thenReturn(student);
        when(academic.answer(any())).thenReturn(new AcademicChatService.Answer(
                "Học kỳ 2025-2: Đã đăng ký 12/24 tín chỉ.",
                List.of("Database", "Semester 2025-2"),
                List.of("Xem môn mở")
        ));

        var capturedBody = new AtomicReference<String>();
        var capturedAuth = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/chat", exchange -> {
            capturedBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            capturedAuth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] responseBytes = "{\"reply\":\"Bạn còn đăng ký thêm tối đa 12 tín chỉ trong học kỳ này.\"}"
                    .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json; charset=UTF-8");
            exchange.sendResponseHeaders(200, responseBytes.length);
            exchange.getResponseBody().write(responseBytes);
            exchange.close();
        });
        server.start();

        try {
            String webhookUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/api/chat";
            var adapter = ChatbotService.buildAdapter(RestClient.builder(), "CUSTOM_WEBHOOK", webhookUrl, "", "", 5);
            var service = new ChatbotService(academic, auth, adapter);

            assertTrue(service.aiConfigured());
            assertEquals("CUSTOM_WEBHOOK", service.providerName());

            var response = service.respond(new ChatRequest(
                    "Tôi còn đăng ký được bao nhiêu tín chỉ?",
                    List.of(new ChatHistoryMessage("user", "Xin chào"))
            ));

            assertTrue(response.aiPowered());
            assertEquals("ONLINE", response.mode());
            assertTrue(response.reply().contains("12/24 tín chỉ"));
            assertTrue(response.reply().contains("Bạn còn đăng ký thêm tối đa 12 tín chỉ"));
            assertNull(capturedAuth.get());
            assertTrue(capturedBody.get().contains("\"verifiedContext\""));
            assertTrue(capturedBody.get().contains("\"B23DCCN001\""));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void geminiAndGroqPresetsConfigureOpenAiCompatibleAdapterAutomatically() {
        var gemini = ChatbotService.buildAdapter(
                RestClient.builder(),
                "GEMINI",
                OpenAiCompatibleAiAdapter.OPENAI_DEFAULT_URL,
                "AIzaSyDummyKey",
                OpenAiCompatibleAiAdapter.OPENAI_DEFAULT_MODEL,
                5
        );
        assertTrue(gemini.isConfigured());
        assertEquals("GEMINI", gemini.providerName());

        var groq = ChatbotService.buildAdapter(
                RestClient.builder(),
                "GROQ",
                "",
                "gsk_DummyKey",
                "",
                5
        );
        assertTrue(groq.isConfigured());
        assertEquals("GROQ", groq.providerName());
    }

    @Test
    void dotEnvParserStripsQuotesCommentsAndGmailAppPasswordSpaces(@TempDir Path tempDir) throws Exception {
        Path envFile = tempDir.resolve(".env");
        Files.writeString(envFile, """
                # Cấu hình thử nghiệm
                AI_PROVIDER="GEMINI"
                AI_API_KEY='AIzaSyTest123'
                SMTP_HOST=smtp.gmail.com
                SMTP_USERNAME=demo.student@gmail.com
                SMTP_PASSWORD="abcd efgh ijkl mnop"
                EMPTY_KEY=
                """, StandardCharsets.UTF_8);

        Map<String, Object> parsed = DotEnvEnvironmentPostProcessor.parseDotEnv(envFile);
        assertEquals("GEMINI", parsed.get("AI_PROVIDER"));
        assertEquals("AIzaSyTest123", parsed.get("AI_API_KEY"));
        assertEquals("abcd" + "efgh" + "ijkl" + "mnop", parsed.get("SMTP_PASSWORD"));
        assertFalse(parsed.containsKey("EMPTY_KEY"));
    }

    @Test
    void passwordResetServiceSendsSixDigitOtpEmailAndResetsPassword() throws Exception {
        assertEquals("coursebot.demo@gmail.com",
                PasswordResetService.resolveSenderAddress("noreply@localhost", "coursebot.demo@gmail.com"));
        assertEquals("custom@domain.edu.vn",
                PasswordResetService.resolveSenderAddress("custom@domain.edu.vn", "coursebot.demo@gmail.com"));

        var accountRepo = mock(UserAccountRepository.class);
        var tokenRepo = mock(PasswordResetTokenRepository.class);
        var encoder = new BCryptPasswordEncoder();
        var mailSender = mock(JavaMailSender.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> mailProvider = mock(ObjectProvider.class);
        when(mailProvider.getIfAvailable()).thenReturn(mailSender);

        MimeMessage realMime = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(realMime);

        var account = new UserAccount("sv001", encoder.encode("OldPass@123"),
                UserAccount.Role.STUDENT, "B23DCCN001", null, "sv001@gmail.com");
        var savedToken = new AtomicReference<PasswordResetToken>();
        when(accountRepo.findFirstByEmailIgnoreCase("sv001@gmail.com")).thenReturn(Optional.of(account));
        when(tokenRepo.save(any(PasswordResetToken.class))).thenAnswer(inv -> {
            PasswordResetToken t = inv.getArgument(0);
            savedToken.set(t);
            return t;
        });
        when(tokenRepo.findFirstByAccount_IdAndUsedAtIsNullOrderByIdDesc(any()))
                .thenAnswer(inv -> Optional.ofNullable(savedToken.get()));

        var resetService = new PasswordResetService(
                accountRepo, tokenRepo, encoder, mailProvider,
                "smtp.gmail.com", "coursebot.demo@gmail.com",
                "http://localhost:8080", "noreply@localhost"
        );

        resetService.requestReset("sv001@gmail.com");
        verify(mailSender, times(1)).send(realMime);
        assertEquals("coursebot.demo@gmail.com", realMime.getFrom()[0].toString());

        String html = realMime.getContent().toString();
        Matcher otpMatcher = Pattern.compile("\\b(\\d{6})\\b").matcher(html);
        assertTrue(otpMatcher.find(), "Email HTML phải chứa mã OTP 6 chữ số");
        String otp = otpMatcher.group(1);

        resetService.reset("sv001@gmail.com", otp, "NewStrong@456");
        assertTrue(encoder.matches("NewStrong@456", account.getPasswordHash()));
        assertNotNull(savedToken.get().getUsedAt());
    }
}
