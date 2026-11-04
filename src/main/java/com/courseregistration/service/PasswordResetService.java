package com.courseregistration.service;

import com.courseregistration.entity.PasswordResetToken;
import com.courseregistration.entity.UserAccount;
import com.courseregistration.repository.PasswordResetTokenRepository;
import com.courseregistration.repository.UserAccountRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Locale;

@Service
public class PasswordResetService {
    private final UserAccountRepository accounts;
    private final PasswordResetTokenRepository tokens;
    private final PasswordEncoder encoder;
    private final ObjectProvider<JavaMailSender> mailSender;
    private final String smtpHost;
    private final String smtpUsername;
    private final String publicUrl;
    private final String from;

    public PasswordResetService(UserAccountRepository accounts,
                                PasswordResetTokenRepository tokens,
                                PasswordEncoder encoder,
                                ObjectProvider<JavaMailSender> mailSender,
                                @Value("${spring.mail.host:}") String smtpHost,
                                @Value("${spring.mail.username:}") String smtpUsername,
                                @Value("${app.public-url:http://localhost:8080}") String publicUrl,
                                @Value("${app.mail.from:noreply@localhost}") String from) {
        this.accounts = accounts;
        this.tokens = tokens;
        this.encoder = encoder;
        this.mailSender = mailSender;
        this.smtpHost = smtpHost;
        this.smtpUsername = smtpUsername;
        this.publicUrl = publicUrl;
        this.from = resolveSenderAddress(from, smtpUsername);
    }

    public static String resolveSenderAddress(String configuredFrom, String smtpUsername) {
        boolean defaultPlaceholder = configuredFrom == null || configuredFrom.isBlank()
                || "noreply@localhost".equalsIgnoreCase(configuredFrom.trim());
        if (defaultPlaceholder && smtpUsername != null && smtpUsername.contains("@")) {
            return smtpUsername.trim();
        }
        return configuredFrom == null || configuredFrom.isBlank() ? "noreply@localhost" : configuredFrom.trim();
    }

    @Transactional
    public void requestReset(String email) {
        if (smtpHost == null || smtpHost.isBlank()) {
            throw new IllegalStateException("Chức năng khôi phục mật khẩu chưa được cấu hình dịch vụ email (thiếu SMTP_HOST trong .env).");
        }
        UserAccount account = accounts.findFirstByEmailIgnoreCase(email.trim()).orElse(null);
        if (account == null) return;
        String raw = String.format(Locale.ROOT, "%06d", new SecureRandom().nextInt(1_000_000));
        String hash = sha256(raw);
        tokens.deleteAllByAccount_Id(account.getId());
        tokens.save(new PasswordResetToken(account, hash, LocalDateTime.now().plusMinutes(10)));
        send(account, raw);
    }

    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public void reset(String email, String rawToken, String newPassword) {
        UserAccount account = accounts.findFirstByEmailIgnoreCase(email.trim())
                .orElseThrow(() -> new IllegalArgumentException("Email hoặc mã OTP không hợp lệ."));
        PasswordResetToken token = tokens.findFirstByAccount_IdAndUsedAtIsNullOrderByIdDesc(account.getId())
                .orElseThrow(() -> new IllegalArgumentException("Email hoặc mã OTP không hợp lệ."));
        if (token.getExpiresAt().isBefore(LocalDateTime.now()))
            throw new IllegalArgumentException("Mã OTP đã hết hạn. Hãy yêu cầu mã mới.");
        if (token.getAttempts() >= 5)
            throw new IllegalArgumentException("Mã OTP đã bị khóa sau nhiều lần nhập sai. Hãy yêu cầu mã mới.");
        if (!MessageDigest.isEqual(token.getTokenHash().getBytes(StandardCharsets.UTF_8), sha256(rawToken).getBytes(StandardCharsets.UTF_8))) {
            token.recordFailedAttempt();
            throw new IllegalArgumentException("Email hoặc mã OTP không hợp lệ. Còn " + Math.max(0, 4 - token.getAttempts()) + " lần thử.");
        }
        if (account.getStatus() != UserAccount.Status.ACTIVE)
            throw new IllegalStateException("Tài khoản không hoạt động. Hãy liên hệ quản trị viên.");
        account.setPasswordHash(encoder.encode(newPassword));
        token.markUsed();
    }

    private void send(UserAccount account, String token) {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null) {
            throw new IllegalStateException("Không thể gửi email khôi phục mật khẩu (chưa khởi tạo được JavaMailSender).");
        }
        MimeMessage message = sender.createMimeMessage();
        try {
            var helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(from);
            helper.setTo(account.getEmail());
            helper.setSubject("[EduPortal CourseBot] Mã OTP khôi phục mật khẩu");
            String link = publicUrl.replaceAll("/$", "") + "/reset-password.html";
            helper.setText(
                    "<div style=\"font-family:Arial,sans-serif;max-width:520px;line-height:1.6;color:#202a40\">"
                            + "<h2 style=\"color:#584bd2;margin-bottom:8px\">Khôi phục mật khẩu EduPortal</h2>"
                            + "<p>Xin chào <strong>" + account.getUsername() + "</strong>, mã OTP 6 chữ số để đặt lại mật khẩu của bạn là:</p>"
                            + "<p style=\"font-size:30px;font-weight:800;letter-spacing:8px;padding:14px 20px;background:#f4f2ff;border-radius:10px;display:inline-block;color:#3d2fb0\">"
                            + token + "</p>"
                            + "<p>Mã có hiệu lực trong <strong>10 phút</strong> và chỉ sử dụng được một lần.</p>"
                            + "<p>Nhập mã tại <a href=\"" + link + "\">trang đặt lại mật khẩu</a>. Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.</p>"
                            + "</div>",
                    true
            );
            sender.send(message);
        } catch (MailException | MessagingException exception) {
            LoggerFactory.getLogger(PasswordResetService.class)
                    .warn("SMTP send failed ({})", exception.getClass().getSimpleName());
            throw new IllegalStateException("Không thể gửi email OTP qua máy chủ SMTP. Hãy kiểm tra lại cấu hình SMTP_USERNAME và Gmail App Password (16 ký tự) trong file .env.");
        }
    }

    private String sha256(String value) {
        try {
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể tạo mã khôi phục.");
        }
    }
}
