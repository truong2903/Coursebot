package com.courseregistration.config;

import com.courseregistration.service.TimetableImportService;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

@Configuration
public class TimetableImportInitializer {
    @Bean @Order(10)
    CommandLineRunner importTimetable(TimetableImportService importer,
            @Value("${app.timetable.source-url:}") String sourceUrl,
            @Value("${app.timetable.registration-always-open:false}") boolean manualOpen){
        return args->{if(!sourceUrl.isBlank())LoggerFactory.getLogger(TimetableImportInitializer.class).info(importer.importSource(sourceUrl,manualOpen));};
    }
}
