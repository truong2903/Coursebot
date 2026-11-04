package com.courseregistration.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tự động nạp các biến cấu hình từ file .env ở thư mục gốc dự án (DATABASE_URL, AI_*, SMTP_*)
 * với độ ưu tiên thấp hơn biến môi trường hệ điều hành và thuộc tính @SpringBootTest.
 */
public class DotEnvEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {
    private static final String SOURCE_NAME = "coursebotDotEnv";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String dsUrl = environment.getProperty("spring.datasource.url");
        if (dsUrl != null && dsUrl.startsWith("jdbc:h2:")) {
            // Giữ môi trường kiểm thử tự động H2 hoàn toàn độc lập với file .env cục bộ
            return;
        }
        Map<String, Object> loaded = parseDotEnv(Path.of(".env"));
        if (!loaded.isEmpty()) {
            environment.getPropertySources().addLast(new MapPropertySource(SOURCE_NAME, loaded));
        }
    }

    public static Map<String, Object> parseDotEnv(Path dotEnvPath) {
        Map<String, Object> props = new LinkedHashMap<>();
        if (!Files.isRegularFile(dotEnvPath)) {
            return props;
        }
        try {
            for (String rawLine : Files.readAllLines(dotEnvPath, StandardCharsets.UTF_8)) {
                String line = rawLine.replace("\uFEFF", "").trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                if (line.startsWith("export ")) {
                    line = line.substring("export ".length()).trim();
                }
                int eq = line.indexOf('=');
                if (eq <= 0) {
                    continue;
                }
                String key = line.substring(0, eq).trim();
                String value = line.substring(eq + 1).trim();
                if (value.length() >= 2 && ((value.startsWith("\"") && value.endsWith("\""))
                        || (value.startsWith("'") && value.endsWith("'")))) {
                    value = value.substring(1, value.length() - 1);
                }
                if (!key.isEmpty() && !value.isEmpty()) {
                    props.put(key, value);
                }
            }
            Object smtpHost = props.get("SMTP_HOST");
            Object smtpPass = props.get("SMTP_PASSWORD");
            if (smtpHost != null && smtpHost.toString().toLowerCase().contains("gmail.com") && smtpPass != null) {
                // Google hiển thị App Password dạng "abcd efgh ijkl mnop" — tự chuẩn hóa bỏ khoảng trắng
                props.put("SMTP_PASSWORD", smtpPass.toString().replaceAll("\\s+", ""));
            }
        } catch (IOException ignored) {
        }
        return props;
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
