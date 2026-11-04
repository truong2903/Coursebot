# Chương 5: Thiết kế Kiến trúc Thành phần, Triển khai & Cơ sở dữ liệu Vật lý (25 Bảng PostgreSQL)

> [!IMPORTANT]
> Toàn bộ **04 biểu đồ kiến trúc & CSDL vật lý** trong chương này được trích xuất đối chiếu trực tiếp từ mã nguồn thực tế (`Spring Boot 3.5.16` / `Java 21`) và lược đồ `pg_dump` trên **Neon Serverless PostgreSQL 16** ([coursebot_academic_demo.sql](file:///e:/CODE/PTvTKHDT/Code%20Project/data/exports/coursebot_academic_demo.sql)), bảo đảm khớp 100% từng tên bảng, kiểu dữ liệu cột, khóa chính (`PK`), khóa ngoại (`FK`), ràng buộc duy nhất (`UNIQUE`), ràng buộc miền giá trị (`CHECK`) và chỉ mục (`B-Tree Index`).

---

## 5.1. Biểu đồ Thành phần & Biểu đồ Triển khai Hệ thống (UML 2.5)

````carousel
![Hình 5.1 — Biểu đồ Thành phần Kiến trúc Phân tầng Hệ thống CourseBot (Component Diagram)](C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/01_Arch_Component_Diagram.png)
<!-- slide -->
![Hình 5.2 — Biểu đồ Triển khai Vật lý & Đám mây Hệ thống CourseBot (Deployment Diagram)](C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/02_Arch_Deployment_Diagram.png)
````

### Đặc tả Kiến trúc Phân tầng & Giao thức Triển khai

| Tầng / Nút triển khai | Thành phần cốt lõi trong mã nguồn | Giao thức & Cơ chế Kỹ thuật |
| :--- | :--- | :--- |
| **1. Tầng Giao diện (Presentation SPA)** | `index.html` + `dashboard.js` (Cổng Sinh viên), `workspace.html` + `workspace.js` (Cổng Giảng viên / Ban ĐT / Admin), `auth/*.html`, `api.js` | Giao tiếp bất đồng bộ `Fetch JSON` qua `HTTP/HTTPS`; tự động đính kèm cookie phiên `JSESSIONID` (`HttpOnly`, `SameSite=Lax`, timeout `30m`) và header chống giả mạo `X-XSRF-TOKEN`. |
| **2. Tầng Điều phối & Bảo mật (Web & Security)** | `SecurityConfig` (`SecurityFilterChain`), 12 REST Controllers (`Auth`, `Enrollment`, `StudentAcademic`, `TrainingManagement`, `Chatbot`, `AccountManagement`, `RolePermission`, `AuditLog`...) | Phân quyền động RBAC kết hợp bảng `role_permissions`; kiểm soát tần suất gọi Chatbot (`Rate Limiter`) và chuẩn hóa phản hồi lỗi qua `ApiExceptionHandler`. |
| **3. Tầng Nghiệp vụ & Chính sách (Domain & Policy)** | `EnrollmentService` + 6 lớp `EnrollmentRule` (**Strategy Pattern**), `CourseConditionEvaluator`, `TrainingManagementService`, `ChatbotService` + `AcademicChatService` + 2 lớp `AiProviderAdapter` (**Adapter Pattern**), `PasswordResetService` | Quản lý giao dịch ACID (`@Transactional`), tách biệt luật kiểm tra học phần theo thứ tự `@Order` và cô lập giao thức gọi AI ngoài (`ONLINE` / `FALLBACK` / `LOCAL`). |
| **4. Tầng Bền vững Dữ liệu (Persistence Tier)** | 20 `JpaRepository`, `DotEnvEnvironmentPostProcessor`, `AcademicDataImportInitializer`, `TimetableImportInitializer` | Kết nối **Neon PostgreSQL 16** qua `HikariCP` (`TCP 5432`, `TLS 1.3 sslmode=require`), tắt `open-in-view`, gom lô truy vấn `default_batch_fetch_size=128` và `jdbc.batch_size=100`. |
| **5. Dịch vụ Đám mây Ngoài (External Services)** | **Gemini / Groq / OpenAI API**, **Máy chủ Chatbot riêng của thành viên nhóm**, **Gmail SMTP (`smtp.gmail.com:587`)** | `HTTPS POST` (`Bearer API Key`, timeout `12s`) hoặc Custom Webhook (`X-API-Key`); gửi mã OTP 6 chữ số qua `SMTP + STARTTLS`. |

---

## 5.2. Thiết kế Cơ sở Dữ liệu Vật lý PostgreSQL 16 (ERD 25 Bảng)

````carousel
![Hình 5.3 — Sơ đồ Thực thể Liên kết Vật lý Tổng thể 25 Bảng PostgreSQL (Master Physical ERD)](C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/03_ERD_Master_25_Tables.png)
<!-- slide -->
![Hình 5.4 — Sơ đồ ERD Chi tiết Ràng buộc Toàn vẹn Cụm Đăng ký, Điều kiện & Thời khóa biểu](C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/04_ERD_Core_Enrollment_Timetable_Detail.png)
````

---

## 5.3. Danh mục Tổng hợp Toàn bộ 25 Bảng Vật lý trong Schema `public`

> [!NOTE]
> Bộ dữ liệu chuẩn hóa trên Neon Cloud gồm tổng cộng **3.196 bản ghi khởi tạo** trải đều trên 25 bảng vật lý (chia làm 5 phân vùng nghiệp vụ), được đối soát toàn vẹn tự động bằng chữ ký băm `SHA-256`.

| STT | Tên bảng vật lý | Phân nhóm | Khóa chính (`PK`) | Khóa ngoại (`FK`) & Ràng buộc (`UK` / `CHECK` / `IDX`) | Số dòng chuẩn |
| :---: | :--- | :--- | :--- | :--- | :---: |
| 01 | `departments` | Tổ chức & Hồ sơ | `code varchar(40)` | Danh mục gốc Khoa / Viện đào tạo | 6 |
| 02 | `academic_programs` | Tổ chức & Hồ sơ | `code varchar(40)` | `FK(department_code) -> departments(code)` | 6 |
| 03 | `administrative_classes` | Tổ chức & Hồ sơ | `code varchar(40)` | `FK(program_code) -> academic_programs(code)` | 18 |
| 04 | `students` | Tổ chức & Hồ sơ | `id bigint` | `UK(student_code)`, `FK(administrative_class_code) -> administrative_classes(code)` | 90 |
| 05 | `student_completed_courses` | Tổ chức & Hồ sơ | *(Bảng tập hợp)* | `FK(student_id) -> students(id)` (`@ElementCollection` môn tích lũy) | 845 |
| 06 | `lecturers` | Tổ chức & Hồ sơ | `id bigint` | `UK(lecturer_code)`, `FK(academic_department_code) -> departments(code)` | 21 |
| 07 | `courses` | Học phần & CTĐT | `id bigint` | `UK(code)` — Danh mục học phần và số tín chỉ | 73 |
| 08 | `course_prerequisites` | Học phần & CTĐT | *(Bảng tập hợp)* | `FK(course_id) -> courses(id)` (Tương thích mã tiên quyết nhanh) | 46 |
| 09 | `course_conditions` | Học phần & CTĐT | `id bigint` | `FK(course_id, condition_course_id) -> courses(id)`, `UK(course_id, condition_course_id, condition_type)` | 53 |
| 10 | `curricula` | Học phần & CTĐT | `id bigint` | `UK(code)`, `CHECK(status IN ('DRAFT','ACTIVE','ARCHIVED'))` | 18 |
| 11 | `curriculum_courses` | Học phần & CTĐT | `id bigint` | `FK(curriculum_id)`, `FK(course_id)`, `UK(curriculum_id, course_id)` | 462 |
| 12 | `semesters` | Học kỳ & TKB | `id bigint` | `UK(code)`, `CHECK(status IN ('PLANNED','ACTIVE','COMPLETED','ARCHIVED'))` | 6 |
| 13 | `registration_periods` | Học kỳ & TKB | `id bigint` | `FK & UK(semester_id) -> semesters(id)` (1–1), `CHECK(status)` | 6 |
| 14 | `teaching_periods` | Học kỳ & TKB | `code integer` | Khung 12 tiết học chuẩn trong ngày (`starts_at`, `ends_at`) | 12 |
| 15 | `course_sections` | Học kỳ & TKB | `id varchar(40)` | `FK(course_id, semester_id, lecturer_id)`, `CHECK(status IN ('OPEN','CLOSED','CANCELLED'))` | 52 |
| 16 | `section_meetings` | Học kỳ & TKB | `id bigint` | `FK(section_id) -> course_sections(id)`, `INDEX idx_meeting_section` | 52 |
| 17 | `enrollments` | Giao dịch Học vụ | `id bigint` | `FK(student_id, section_id)`, `UK(student_id, section_id)`, `CHECK(status IN ('ENROLLED','CANCELLED','PENDING'))` | 412 |
| 18 | `waitlist_entries` | Giao dịch Học vụ | `id bigint` | `FK(student_id, section_id)`, `UK(student_id, section_id)`, `CHECK(status IN ('WAITING','PROMOTED','CANCELLED'))` | Động (FIFO) |
| 19 | `academic_results` | Giao dịch Học vụ | `id bigint` | `FK(student_id, course_id, semester_id)`, `UK(student_id, course_id, semester_id)` | 894 |
| 20 | `user_accounts` | Bảo mật & Hệ thống | `id bigint` | `UK(username)`, `CHECK(role)`, `CHECK(status IN ('ACTIVE','LOCKED','DISABLED'))` | 113 |
| 21 | `password_reset_tokens` | Bảo mật & Hệ thống | `id bigint` | `FK(account_id) -> user_accounts(id)`, `UK(token_hash)` (Băm SHA-256 mã OTP) | Động (OTP) |
| 22 | `role_permissions` | Bảo mật & Hệ thống | `id bigint` | `UK(role_name, permission_key)`, `CHECK(role_name)` | 14 |
| 23 | `audit_logs` | Bảo mật & Hệ thống | `id bigint` | Nhật ký kiểm toán hành động quản trị & học vụ nhạy cảm | Động (Log) |
| 24 | `academic_data_imports` | Bảo mật & Hệ thống | `sha256 varchar(64)` | Lưu `manifest_json` đối soát nạp dữ liệu học vụ idempotent | 1 |
| 25 | `timetable_app_imports` | Bảo mật & Hệ thống | `sha256 varchar(64)` | Lưu dấu vân tay `SHA-256` của gói thời khóa biểu đã nạp | Động |

---

## 5.4. Cơ chế Toàn vẹn Giao dịch Đồng thời & Tối ưu Hóa Truy vấn

1. **Chống tranh chấp chỗ trống cuối cùng bằng Khóa Bi quan (`PESSIMISTIC_WRITE`)**:
   - Khi nhiều sinh viên cùng bấm đăng ký vào 1 chỗ trống cuối cùng của lớp học phần, `CourseSectionRepository.findByIdForUpdate()` phát lệnh khóa dòng cấp CSDL (`SELECT ... FOR NO KEY UPDATE` trên PostgreSQL), buộc các giao dịch đồng thời xếp hàng tuần tự và loại bỏ triệt để lỗi vượt trần sĩ số (`over-enrollment`).
2. **Bảo vệ Kép ở Tầng Ứng dụng & Tầng Vật lý (Defense-in-Depth Constraints)**:
   - Ngay cả khi có request gửi đúp đồng thời, các ràng buộc phức hợp `UNIQUE (student_id, section_id)` trên `enrollments` / `waitlist_entries`, `UNIQUE (student_id, course_id, semester_id)` trên `academic_results`, và `UNIQUE (course_id, condition_course_id, condition_type)` trên `course_conditions` ngăn chặn hoàn toàn bản ghi trùng lặp ở mức Engine lưu trữ.
3. **Loại bỏ bài toán `N+1 Queries` & Tăng tốc Kiểm tra Trùng lịch**:
   - Cấu hình `spring.jpa.open-in-view=false` kết hợp `hibernate.default_batch_fetch_size=128`, `hibernate.jdbc.batch_size=100` và chỉ mục B-Tree `idx_meeting_section(section_id)` giúp nạp toàn bộ lịch ca học của học kỳ để kiểm tra giao thoa tuần học (`weeks_expression`) với độ trễ chỉ vài mili-giây.
4. **Bảo mật Mật khẩu & OTP Không Lưu Bản Rõ**:
   - Mật khẩu người dùng trong `user_accounts.password_hash` được băm bằng `BCrypt`; mã OTP 6 chữ số khôi phục mật khẩu không bao giờ lưu dạng rõ mà chỉ lưu chuỗi băm `SHA-256` 64 ký tự trong `password_reset_tokens.token_hash` kèm thời hạn 10 phút và bộ đếm giới hạn tối đa 5 lần thử sai.
