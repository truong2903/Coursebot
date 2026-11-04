package com.courseregistration.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** The single-page UI is served from Spring Boot's standard static resource directory. */
@Configuration
public class WebConfig implements WebMvcConfigurer {}
