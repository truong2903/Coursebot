package com.courseregistration.config;

import com.courseregistration.service.AcademicDataImportService;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;

@Configuration
public class AcademicDataImportInitializer {
    @Bean @Order(150)
    CommandLineRunner importAcademicData(AcademicDataImportService importer,
            @Value("${app.academic.source-url:}") String sourceUrl,
            @Value("${app.academic.initial-password:}") String initialPassword) {
        return args->{if(!sourceUrl.isBlank())LoggerFactory.getLogger(AcademicDataImportInitializer.class).info(importer.importSource(sourceUrl,initialPassword));};
    }
}
