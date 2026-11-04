package com.courseregistration.config;

import com.courseregistration.entity.UserAccount;
import com.courseregistration.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.security.SecureRandom;
import java.util.Base64;

@Configuration
public class BootstrapAdminInitializer {
    private static final Logger log = LoggerFactory.getLogger(BootstrapAdminInitializer.class);

    @Bean
    @org.springframework.core.annotation.Order(100)
    CommandLineRunner bootstrapAdmin(UserAccountRepository accounts, PasswordEncoder encoder,
                                     @Value("${app.bootstrap.admin-username:admin}") String username,
                                     @Value("${APP_BOOTSTRAP_ADMIN_PASSWORD:}") String configuredPassword) {
        return args -> {
            if (accounts.count() != 0) return;
            String password = configuredPassword;
            if (password == null || password.isBlank()) {
                byte[] random = new byte[24];
                new SecureRandom().nextBytes(random);
                password = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
                log.warn("Initial administrator account created. Set APP_BOOTSTRAP_ADMIN_PASSWORD for a known password; generated one-time password: {}", password);
            } else if (password.length() < 10) {
                throw new IllegalStateException("APP_BOOTSTRAP_ADMIN_PASSWORD must contain at least 10 characters.");
            }
            accounts.save(new UserAccount(username, encoder.encode(password), UserAccount.Role.ADMIN, null, null, null));
        };
    }
}
