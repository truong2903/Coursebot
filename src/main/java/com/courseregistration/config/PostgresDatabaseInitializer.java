package com.courseregistration.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * Supports both single-link Cloud PostgreSQL URIs (DATABASE_URL / .env, e.g. Neon/Supabase)
 * and automatic database creation on local PostgreSQL instances.
 */
@Configuration
public class PostgresDatabaseInitializer {
    private static final Logger log = LoggerFactory.getLogger(PostgresDatabaseInitializer.class);

    @Bean
    public static BeanPostProcessor postgresDatabaseAutoCreator(Environment env) {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
                if (bean instanceof DataSourceProperties props) {
                    String configuredUrl = props.getUrl();
                    // Never interfere with H2 in-memory integration tests
                    if (configuredUrl != null && configuredUrl.startsWith("jdbc:h2:")) {
                        return bean;
                    }

                    String cloudDatabaseUrl = resolveDatabaseUrl(env, configuredUrl);
                    if (cloudDatabaseUrl != null && !cloudDatabaseUrl.isBlank()) {
                        applyConnectionUri(props, cloudDatabaseUrl.trim());
                    }

                    boolean autoCreate = env.getProperty("app.datasource.auto-create-db", Boolean.class, true);
                    String finalUrl = props.getUrl();
                    if (autoCreate && finalUrl != null && finalUrl.startsWith("jdbc:postgresql://")) {
                        ensureLocalDatabaseExists(finalUrl, props.getUsername(), props.getPassword());
                    }
                }
                return bean;
            }
        };
    }

    private static String resolveDatabaseUrl(Environment env, String configuredUrl) {
        String envDbUrl = env.getProperty("DATABASE_URL");
        if (envDbUrl != null && !envDbUrl.isBlank()) {
            return envDbUrl;
        }
        if (configuredUrl != null && (configuredUrl.startsWith("postgresql://")
                || configuredUrl.startsWith("postgres://")
                || (configuredUrl.startsWith("jdbc:postgresql://") && configuredUrl.contains("@")))) {
            return configuredUrl;
        }
        // Only fall back to local .env file if neither SPRING_DATASOURCE_URL nor DB_NAME was explicitly overridden
        String explicitDatasourceUrl = env.getProperty("SPRING_DATASOURCE_URL");
        String explicitDbName = env.getProperty("DB_NAME");
        if ((explicitDatasourceUrl == null || explicitDatasourceUrl.isBlank())
                && (explicitDbName == null || explicitDbName.isBlank())) {
            return readDotEnvDatabaseUrl(Path.of(".env"));
        }
        return null;
    }

    static String readDotEnvDatabaseUrl(Path dotEnvPath) {
        if (!Files.isRegularFile(dotEnvPath)) {
            return null;
        }
        try {
            for (String rawLine : Files.readAllLines(dotEnvPath, StandardCharsets.UTF_8)) {
                String line = rawLine.replace("\uFEFF", "").trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                if (line.startsWith("DATABASE_URL=")) {
                    String val = line.substring("DATABASE_URL=".length()).trim();
                    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.substring(1, val.length() - 1);
                    }
                    return val.isBlank() ? null : val;
                }
            }
        } catch (IOException ignored) {
        }
        return null;
    }

    static void applyConnectionUri(DataSourceProperties props, String rawUri) {
        String normalized = rawUri;
        if (normalized.startsWith("jdbc:")) {
            normalized = normalized.substring("jdbc:".length());
        }
        if (normalized.startsWith("postgres://")) {
            normalized = "postgresql://" + normalized.substring("postgres://".length());
        }
        URI uri = URI.create(normalized);
        String userInfo = uri.getUserInfo();
        if (userInfo != null && !userInfo.isBlank()) {
            int colon = userInfo.indexOf(':');
            if (colon >= 0) {
                props.setUsername(URLDecoder.decode(userInfo.substring(0, colon), StandardCharsets.UTF_8));
                props.setPassword(URLDecoder.decode(userInfo.substring(colon + 1), StandardCharsets.UTF_8));
            } else {
                props.setUsername(URLDecoder.decode(userInfo, StandardCharsets.UTF_8));
            }
        }
        String host = uri.getHost();
        int port = uri.getPort();
        String path = (uri.getPath() == null || uri.getPath().isBlank()) ? "/postgres" : uri.getPath();

        List<String> params = new ArrayList<>();
        boolean hasPrepareThreshold = false;
        if (uri.getRawQuery() != null && !uri.getRawQuery().isBlank()) {
            for (String pair : uri.getRawQuery().split("&")) {
                if (pair.isBlank()) continue;
                // pgjdbc uses camelCase channelBinding; omit snake_case channel_binding over PgBouncer poolers if unsupported
                if (pair.startsWith("channel_binding=")) {
                    String cbVal = pair.substring("channel_binding=".length());
                    if (host != null && host.contains("-pooler.") && "require".equalsIgnoreCase(cbVal)) {
                        params.add("channelBinding=prefer");
                    } else {
                        params.add("channelBinding=" + cbVal);
                    }
                    continue;
                }
                if (pair.startsWith("prepareThreshold=")) {
                    hasPrepareThreshold = true;
                }
                params.add(pair);
            }
        }
        if (host != null && host.contains("-pooler.") && !hasPrepareThreshold) {
            params.add("prepareThreshold=0");
        }
        String query = String.join("&", params);
        String jdbcUrl = "jdbc:postgresql://" + host + (port > 0 ? ":" + port : "") + path
                + (query.isEmpty() ? "" : "?" + query);
        props.setUrl(jdbcUrl);
        log.info("Đã cấu hình kết nối PostgreSQL từ link chia sẻ tới host '{}' (database '{}').",
                host, path.startsWith("/") ? path.substring(1) : path);
    }

    private static void ensureLocalDatabaseExists(String jdbcUrl, String username, String password) {
        URI uri;
        try {
            uri = URI.create(jdbcUrl.substring("jdbc:".length()));
        } catch (IllegalArgumentException ex) {
            return;
        }
        String host = uri.getHost();
        if (host == null || (!"localhost".equalsIgnoreCase(host) && !"127.0.0.1".equals(host) && !"::1".equals(host))) {
            // Cloud PostgreSQL instances (Neon, Supabase, etc.) pre-create the database in their console.
            return;
        }
        String path = uri.getPath();
        if (path == null || path.length() <= 1) {
            return;
        }
        String dbName = path.substring(1);
        if ("postgres".equalsIgnoreCase(dbName) || !dbName.matches("^[A-Za-z0-9_]+$")) {
            return;
        }
        int port = uri.getPort();
        String adminUrl = "jdbc:postgresql://" + host + (port > 0 ? ":" + port : "") + "/postgres"
                + (uri.getRawQuery() != null ? "?" + uri.getRawQuery() : "");

        String effectiveUser = (username == null || username.isBlank()) ? "postgres" : username;
        String effectivePassword = password == null ? "" : password;

        try (Connection conn = DriverManager.getConnection(adminUrl, effectiveUser, effectivePassword)) {
            boolean exists;
            try (PreparedStatement ps = conn.prepareStatement("SELECT 1 FROM pg_database WHERE datname = ?")) {
                ps.setString(1, dbName);
                try (ResultSet rs = ps.executeQuery()) {
                    exists = rs.next();
                }
            }
            if (!exists) {
                try (Statement st = conn.createStatement()) {
                    st.execute("CREATE DATABASE \"" + dbName + "\" ENCODING 'UTF8'");
                }
                log.info("Đã tự động tạo database PostgreSQL mới: {}", dbName);
            }
        } catch (SQLException ex) {
            String state = ex.getSQLState();
            if ("28P01".equals(state) || "28000".equals(state)) {
                throw new IllegalStateException(
                        "Xác thực PostgreSQL thất bại cho user '" + effectiveUser
                                + "'. Hãy đặt biến môi trường DB_PASSWORD (hoặc SPRING_DATASOURCE_PASSWORD) đúng mật khẩu PostgreSQL.",
                        ex);
            }
            if (!"42P04".equals(state)) {
                log.warn("Bỏ qua bước tự tạo database '{}' qua 'postgres' ({}). Tiếp tục kết nối trực tiếp.",
                        dbName, ex.getMessage());
            }
        }
    }
}
