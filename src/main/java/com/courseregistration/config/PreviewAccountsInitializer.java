package com.courseregistration.config;

import com.courseregistration.entity.Lecturer;
import com.courseregistration.entity.Semester;
import com.courseregistration.entity.Student;
import com.courseregistration.entity.UserAccount;
import com.courseregistration.repository.LecturerRepository;
import com.courseregistration.repository.SemesterRepository;
import com.courseregistration.repository.StudentRepository;
import com.courseregistration.repository.UserAccountRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;

/** Seeds stable role preview accounts only when explicitly enabled for the local preview database. */
@Configuration
public class PreviewAccountsInitializer {
    @Bean
    @org.springframework.core.annotation.Order(200)
    CommandLineRunner previewAccounts(UserAccountRepository accounts, StudentRepository students,
                                      LecturerRepository lecturers, SemesterRepository semesters,
                                      PasswordEncoder encoder,
                                      @Value("${app.preview.accounts-enabled:false}") boolean enabled) {
        return args -> {
            if (!enabled) return;
            seedAccount(accounts, encoder, "preview_student", "SVPreview2026!", UserAccount.Role.STUDENT,
                    "SVPREVIEW01", null, "preview.student@example.test");
            seedAccount(accounts, encoder, "preview_lecturer", "GVPreview2026!", UserAccount.Role.LECTURER,
                    null, "GVPREVIEW01", "preview.lecturer@example.test");
            seedAccount(accounts, encoder, "preview_training", "TrainingPreview2026!", UserAccount.Role.TRAINING_OFFICE,
                    null, null, "preview.training@example.test");

            Student student = students.findByStudentCode("SVPREVIEW01")
                    .orElseGet(() -> new Student("SVPREVIEW01", "Sinh viên xem trước", "Công nghệ thông tin", "preview.student@example.test"));
            student.updateProfile("Sinh viên xem trước", "Công nghệ thông tin", "K2026", "preview.student@example.test");
            students.save(student);

            Lecturer lecturer = lecturers.findByLecturerCode("GVPREVIEW01")
                    .orElseGet(() -> new Lecturer("GVPREVIEW01", "Giảng viên xem trước", "Khoa Công nghệ thông tin"));
            lecturer.setFullName("Giảng viên xem trước");
            lecturer.setDepartment("Khoa Công nghệ thông tin");
            lecturers.save(lecturer);

            if (!semesters.existsByCodeIgnoreCase("PREVIEW-2026")) {
                LocalDate today = LocalDate.now();
                Semester semester = new Semester("PREVIEW-2026", "Học kỳ xem trước 2026", today,
                        today.minusDays(30), today.plusDays(90));
                semester.update("Học kỳ xem trước 2026", today, today.plusDays(150),
                        today.minusDays(30), today.plusDays(90), Semester.Status.ACTIVE);
                semesters.save(semester);
            }
        };
    }

    private void seedAccount(UserAccountRepository accounts, PasswordEncoder encoder, String username, String password,
                             UserAccount.Role role, String studentCode, String lecturerCode, String email) {
        UserAccount account = accounts.findByUsernameIgnoreCase(username)
                .orElseGet(() -> new UserAccount(username, encoder.encode(password), role, studentCode, lecturerCode, email));
        account.setRole(role);
        account.setStatus(UserAccount.Status.ACTIVE);
        account.setStudentCode(studentCode);
        account.setLecturerCode(lecturerCode);
        account.setEmail(email);
        // Keep the documented preview credentials stable across preview restarts.
        account.setPasswordHash(encoder.encode(password));
        accounts.save(account);
    }
}
