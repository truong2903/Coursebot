# Mô tả Ngắn gọn 25 Bảng Cơ sở Dữ liệu CourseBot (PostgreSQL 16)

> Tổng cộng **25 bảng vật lý** (schema `public`), gồm **3.321 bản ghi** chuẩn hóa đạt chuẩn **3NF**, phân chia thành **5 nhóm nghiệp vụ**.

---

## 1. Tổ chức Đào tạo & Hồ sơ Học vụ (6 bảng)

1. **`departments`** *(6 dòng)* — **PK:** `code`
   - Lưu danh mục các Khoa / Trường đào tạo (ví dụ: `DDT` – Trường Điện – Điện tử, `CNTT` – Khoa Công nghệ thông tin).
2. **`academic_programs`** *(7 dòng)* — **PK:** `code` | **FK:** `department_code → departments`
   - Lưu danh mục các Ngành đào tạo trực thuộc từng Khoa/Trường (ví dụ: `7520207` – Kỹ thuật Điện tử – Viễn thông).
3. **`administrative_classes`** *(19 dòng)* — **PK:** `code` | **FK:** `program_code → academic_programs`
   - Lưu danh mục Lớp hành chính theo khóa tuyển sinh (ví dụ: `ET-TN K68`, `IT24A`).
4. **`students`** *(94 dòng)* — **PK:** `id` | **UK:** `student_code` | **FK:** `administrative_class_code → administrative_classes`
   - Lưu hồ sơ sinh viên (MSSV, họ tên, ngành, khóa, email, SĐT, trạng thái học tập). Bao gồm 4 thành viên nhóm `ET-TN K68` (`20233686`, `20233458`, `20233460`, `20233704`).
5. **`student_completed_courses`** *(881 dòng)* — **FK:** `student_id → students`
   - Bảng tập hợp (`@ElementCollection`) lưu danh sách mã môn sinh viên đã hoàn thành để tra cứu nhanh khi xét điều kiện đăng ký.
6. **`lecturers`** *(22 dòng)* — **PK:** `id` | **UK:** `lecturer_code` | **FK:** `academic_department_code → departments`
   - Lưu hồ sơ giảng viên (mã GV, họ tên, học vị, học hàm, bộ môn, email, SĐT). Bao gồm `GV000` – TS. Bùi Tiến Cường.

---

## 2. Học phần, Điều kiện & Khung Chương trình (5 bảng)

7. **`courses`** *(73 dòng)* — **PK:** `id` | **UK:** `code`
   - Danh mục toàn bộ học phần của trường (mã môn, tên môn, số tín chỉ, khoa quản lý, mô tả, link đề cương, trạng thái `active`).
8. **`course_prerequisites`** *(46 dòng)* — **FK:** `course_id → courses`
   - Bảng tập hợp lưu danh sách mã môn tiên quyết dạng rút gọn để kiểm tra nhanh.
9. **`course_conditions`** *(53 dòng)* — **PK:** `id` | **FK:** `course_id`, `condition_course_id → courses`
   - Lưu chi tiết **3 loại điều kiện học phần** giữa 2 môn (`condition_type`): **Tiên quyết**, **Học trước**, **Song hành** (có ràng buộc `UNIQUE` chống trùng lặp).
10. **`curricula`** *(19 dòng)* — **PK:** `id` | **UK:** `code`
    - Lưu danh sách Khung chương trình đào tạo theo ngành, khóa, phiên bản và trạng thái (`DRAFT` / `ACTIVE` / `ARCHIVED`), gồm `CTDT-7520207-K2023`.
11. **`curriculum_courses`** *(485 dòng)* — **PK:** `id` | **FK:** `curriculum_id → curricula`, `course_id → courses`
    - Bảng nối chi tiết từng môn học trong khung chương trình kèm học kỳ gợi ý (`suggested_semester`), loại môn bắt buộc/tự chọn (`required_course`) và thứ tự hiển thị.

---

## 3. Học kỳ, Lớp học phần & Thời khóa biểu (5 bảng)

12. **`semesters`** *(6 dòng)* — **PK:** `id` | **UK:** `code`
    - Lưu thông tin học kỳ (mã kỳ, năm học, ngày bắt đầu/kết thúc, ngày bắt đầu tuần 1, số tuần dạy, thời hạn mở/đóng đăng ký, trạng thái `PLANNED` / `ACTIVE` / `COMPLETED` / `ARCHIVED`).
13. **`registration_periods`** *(6 dòng)* — **PK:** `id` | **FK & UK (1–1):** `semester_id → semesters`
    - Lưu thời gian mở/đóng chính xác tới từng phút (`starts_at`, `ends_at`) và trạng thái (`SCHEDULED` / `OPEN` / `CLOSED` / `CANCELLED`) của đợt đăng ký ứng với mỗi học kỳ.
14. **`teaching_periods`** *(12 dòng)* — **PK:** `code` *(1..12)*
    - Lưu khung 12 tiết học chuẩn trong ngày (buổi sáng/chiều, giờ bắt đầu `starts_at`, giờ kết thúc `ends_at`).
15. **`course_sections`** *(52 dòng)* — **PK:** `id` | **FK:** `course_id`, `semester_id`, `lecturer_id`
    - Lưu các lớp học phần mở trong kỳ (mã lớp, giảng viên phụ trách, sĩ số tối đa `capacity`, phòng học, lịch tóm tắt, trạng thái `OPEN` / `CLOSED` / `CANCELLED`). Áp dụng khóa dòng `PESSIMISTIC_WRITE` chống vượt sĩ số.
16. **`section_meetings`** *(52 dòng)* — **PK:** `id` | **FK & IDX:** `section_id → course_sections`
    - Tách chi tiết từng buổi học của lớp (thứ `day_of_week`, tiết bắt đầu, số tiết, giờ học, phòng học, biểu thức tuần `weeks_expression` như `1-15`) để kiểm tra trùng lịch chính xác theo từng buổi/tuần.

---

## 4. Giao dịch Đăng ký, Hàng chờ & Bảng điểm (3 bảng)

17. **`enrollments`** *(424 dòng)* — **PK:** `id` | **FK & UK:** `(student_id, section_id)`
    - Lưu kết quả đăng ký học phần của sinh viên kèm thời điểm đăng ký và trạng thái (`ENROLLED` – Đã đăng ký, `PENDING` – Chờ Ban Đào tạo duyệt, `CANCELLED` – Đã hủy).
18. **`waitlist_entries`** *(động)* — **PK:** `id` | **FK & UK:** `(student_id, section_id)`
    - Lưu hàng chờ tự động **FIFO** (xếp theo `created_at`) khi lớp học phần đã đủ sĩ số. Khi có chỗ trống, hệ thống tự đôn sinh viên đầu hàng đủ điều kiện sang `PROMOTED` và ghi vào `enrollments`.
19. **`academic_results`** *(930 dòng)* — **PK:** `id` | **FK & UK:** `(student_id, course_id, semester_id)`
    - Lưu bảng điểm tích lũy của sinh viên qua các kỳ (điểm hệ 10 `grade`, điểm chữ `letter_grade`, kết quả `Đạt` / `Chưa đạt`), dùng để hiển thị bảng điểm, tính điểm trung bình và xét điều kiện học phần.

---

## 5. Bảo mật RBAC, OTP, Kiểm toán & Đối soát Import (6 bảng)

20. **`user_accounts`** *(119 dòng)* — **PK:** `id` | **UK:** `username`
    - Lưu tài khoản đăng nhập (username, mật khẩu băm `BCrypt`, vai trò `STUDENT` / `LECTURER` / `TRAINING_OFFICE` / `ADMIN`, trạng thái `ACTIVE` / `LOCKED` / `DISABLED`, liên kết `student_code` / `lecturer_code`).
21. **`password_reset_tokens`** *(động)* — **PK:** `id` | **UK:** `token_hash` | **FK:** `account_id → user_accounts`
    - Lưu mã OTP 6 chữ số khôi phục mật khẩu dưới dạng băm `SHA-256`, kèm thời hạn 10 phút (`expires_at`), thời điểm đã dùng (`used_at`) và số lần nhập sai (`attempts`, tối đa 5).
22. **`role_permissions`** *(14 dòng)* — **PK:** `id` | **UK:** `(role_name, permission_key)`
    - Cấu hình phân quyền động theo vai trò (RBAC), ánh xạ mỗi vai trò với các quyền truy cập chức năng cụ thể.
23. **`audit_logs`** *(động)* — **PK:** `id`
    - Lưu nhật ký kiểm toán bất biến mọi thao tác quan trọng (người thực hiện `actor`, hành động `action`, đối tượng `target`, chi tiết `details`, thời điểm `created_at`).
24. **`academic_data_imports`** *(1 dòng)* — **PK:** `sha256`
    - Lưu chữ ký băm `SHA-256` và `manifest_json` của gói dữ liệu học vụ đã nạp để tránh nạp trùng lặp (idempotent).
25. **`timetable_app_imports`** *(động)* — **PK:** `sha256`
    - Lưu chữ ký băm `SHA-256` và thời điểm nạp các gói thời khóa biểu nhập từ tệp ngoài.
