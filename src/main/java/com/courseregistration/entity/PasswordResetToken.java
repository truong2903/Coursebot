package com.courseregistration.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name="password_reset_tokens")
public class PasswordResetToken {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional=false,fetch=FetchType.LAZY)
    private UserAccount account;
    @Column(nullable=false,unique=true,length=64)
    private String tokenHash;
    @Column(nullable=false)
    private LocalDateTime expiresAt;
    private LocalDateTime usedAt;
    private Integer attempts = 0;

    protected PasswordResetToken(){}
    public PasswordResetToken(UserAccount account,String tokenHash,LocalDateTime expiresAt){this.account=account;this.tokenHash=tokenHash;this.expiresAt=expiresAt;}
    public UserAccount getAccount(){return account;}
    public String getTokenHash(){return tokenHash;}
    public LocalDateTime getExpiresAt(){return expiresAt;}
    public LocalDateTime getUsedAt(){return usedAt;}
    public int getAttempts(){return attempts==null?0:attempts;}
    public void recordFailedAttempt(){attempts=getAttempts()+1;if(getAttempts()>=5)markUsed();}
    public void markUsed(){this.usedAt=LocalDateTime.now();}
}
