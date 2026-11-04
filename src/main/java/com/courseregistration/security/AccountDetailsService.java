package com.courseregistration.security;

import com.courseregistration.entity.UserAccount;
import com.courseregistration.repository.UserAccountRepository;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class AccountDetailsService implements UserDetailsService {
    private final UserAccountRepository accounts;
    public AccountDetailsService(UserAccountRepository accounts) { this.accounts = accounts; }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        UserAccount account = accounts.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new UsernameNotFoundException("Tài khoản hoặc mật khẩu không đúng."));
        return User.withUsername(account.getUsername())
                .password(account.getPasswordHash())
                .roles(account.getRole().name())
                .disabled(account.getStatus() != UserAccount.Status.ACTIVE)
                .build();
    }
}
