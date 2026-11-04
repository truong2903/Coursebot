# Chương 3. Phân tích và Thiết kế Lớp Hướng đối tượng (Domain Model & Design Class Diagram — Việc 7)

> [!IMPORTANT]
> Chương 3 này được xây dựng đồng bộ **100% với 23 lớp thực thể JPA, 20 Repository, 14 Service, 12 Controller và 2 mẫu thiết kế GoF (`Strategy Pattern` & `Adapter Pattern`)** trong mã nguồn thực tế của hệ thống `CourseBot`, đồng thời nâng cấp toàn diện từ bản vẽ gốc [`Class_Diagram_24UC.png`](file:///E:/CODE/PTvTKHDT/S%C6%A1%20%C4%91%E1%BB%93/Class_Diagram_24UC.png).
> Trọn bộ ảnh vector `.png`, `.svg` độ phân giải cao và mã nguồn `.puml` (mở được trên Visual Paradigm / draw.io) đã được xuất sẵn tại thư mục [`Chuong3_Class_Diagram/`](file:///E:/CODE/PTvTKHDT/S%C6%A1%20%C4%91%E1%BB%93/Chuong3_Class_Diagram).

---

## 3.1. Bộ Sơ đồ Vector Chuẩn UML 2.5 (Trình chiếu Trực tiếp)

````carousel
![Biểu đồ Lớp Phân tích (Domain Model)](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/01_Domain_Model_Phan_Tich.png)
<!-- slide -->
![Biểu đồ Lớp Thiết kế Tầng Thực thể (Entity Layer)](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/02_Design_Class_Entity_Diagram.png)
<!-- slide -->
![Biểu đồ Lớp Thiết kế Cụm Đăng ký & Mẫu Strategy Pattern (EnrollmentRule)](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/03_Design_Class_Strategy_Enrollment.png)
<!-- slide -->
![Biểu đồ Lớp Thiết kế Cụm Chatbot AI & Mẫu Adapter Pattern (AiProviderAdapter)](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/04_Design_Class_Adapter_Chatbot_Auth.png)
<!-- slide -->
![Biểu đồ Use Case Tổng quát 26 UC (Bổ sung hoàn chỉnh cho Chương 2)](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/00_UseCase_Tong_Quat_26UC.png)
````

---

## 3.2. Đối chiếu các Điểm Nâng cấp từ `Class_Diagram_24UC.png` sang Thiết kế Chuẩn OOP

| Hạng mục | Trong bản cũ (`Class_Diagram_24UC.png`) | Trong Mô hình Lớp chuẩn hóa mới (Khớp 100% Code thật) |
| :--- | :--- | :--- |
| **Danh sách chờ tự động (FIFO)** | Chưa có lớp Danh sách chờ | Bổ sung thực thể [`WaitlistEntry`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/WaitlistEntry.java) (`WAITING`, `PROMOTED`, `CANCELLED`) liên kết `Student` và `CourseSection`. |
| **Điều kiện môn học** | Chỉ mô tả `DieuKienTienQuyet` chung chung | Chuẩn hóa thành [`CourseCondition`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/CourseCondition.java) hỗ trợ đủ **3 loại**: `Tiên quyết`, `Học trước`, `Song hành` kèm phương thức đánh giá `isSatisfiedBy(...)`. |
| **Tổ chức hành chính đại học** | Ghi chuỗi đơn vị dạng text rời rạc | Chuẩn hóa đủ cây phân cấp thực thể: [`Department`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/Department.java) -> [`AcademicProgram`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/AcademicProgram.java) -> [`AdministrativeClass`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/AdministrativeClass.java) -> [`Student`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/Student.java), và [`TeachingPeriod`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/TeachingPeriod.java). |
| **Hành vi hướng đối tượng trên Thực thể (Rich Domain Model)** | Hầu hết các lớp chỉ chứa thuộc tính (Anemic Model) | Đóng gói logic nghiệp vụ ngay trong thực thể: `Enrollment.approve()`, `Enrollment.cancel()`, `SectionMeeting.overlaps()`, `AcademicResult.studiedBefore()`, `RegistrationPeriod.getEffectiveStatus()`, `PasswordResetToken.recordFailedAttempt()`. |
| **Mẫu thiết kế kiểm tra đăng ký** | Gom chung vào 1 hàm `kiemTraDieuKien()` | Áp dụng **GoF Strategy Pattern**: giao diện [`EnrollmentRule`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/policy/EnrollmentRule.java) cùng 6 lớp chiến lược độc lập tuân thủ nguyên lý **Open/Closed Principle (SOLID)**. |
| **Mẫu thiết kế kết nối AI** | Lớp `AIAdvisorService` đóng cứng | Áp dụng **GoF Adapter Pattern**: giao diện [`AiProviderAdapter`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/chat/AiProviderAdapter.java) tách biệt hoàn toàn [`ChatbotService`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/ChatbotService.java) khỏi chuẩn API cụ thể (`OpenAiCompatibleAiAdapter` cho Gemini/Groq và `TeammateWebhookAiAdapter` cho Chatbot riêng của nhóm). |

---

## 3.3. Phân tích Quan hệ Tĩnh (Association, Composition, Aggregation, Realization)

| Loại quan hệ UML | Ký hiệu | Các cặp lớp tiêu biểu trong hệ thống | Giải thích ngữ nghĩa Hướng đối tượng |
| :--- | :--- | :--- | :--- |
| **Composition (Quan hệ Thành phần – Mạnh)** | `◆──` | `Curriculum (1) ◆── (1..*) CurriculumCourse`<br>`CourseSection (1) ◆── (1..*) SectionMeeting`<br>`Semester (1) ◆── (0..1) RegistrationPeriod`<br>`UserAccount (1) ◆── (0..*) PasswordResetToken` | Phần tử con không tồn tại độc lập nếu hủy phần tử cha (`cascade = CascadeType.ALL, orphanRemoval = true`). Ví dụ: một ca học (`SectionMeeting`) thuộc trọn vòng đời của lớp học phần (`CourseSection`). |
| **Aggregation (Quan hệ Tập hợp – Mềm)** | `◇──` | `EnrollmentService ◇── (1..*) EnrollmentRule` | `EnrollmentService` sở hữu tập hợp các chiến lược kiểm tra (`List<EnrollmentRule>`) được tiêm qua Dependency Injection nhưng vòng đời từng Rule độc lập. |
| **Association (Quan hệ Kết hợp & Lớp Trung gian)** | `───` | `Student (1) ── (0..*) Enrollment (0..*) ── (1) CourseSection`<br>`Student (1) ── (0..*) WaitlistEntry (0..*) ── (1) CourseSection`<br>`Course (1) ── (0..*) CourseCondition (0..*) ── (1) Course` | Biểu diễn quan hệ nhiều-nhiều có mang thuộc tính trạng thái/thời gian thông qua lớp thực thể kết hợp (*Association Entity*), đặc biệt `CourseCondition` là quan hệ tự kết hợp có hướng (*Directed Reflexive Association*) giữa môn đích và môn điều kiện. |
| **Realization (Hiện thực hóa Giao diện)** | `- - ▷` | `CreditLimitRule ..▷ EnrollmentRule`<br>`CourseConditionRule ..▷ EnrollmentRule`<br>`OpenAiCompatibleAiAdapter ..▷ AiProviderAdapter`<br>`TeammateWebhookAiAdapter ..▷ AiProviderAdapter` | Thể hiện tính **Đa hình (Polymorphism)** và tuân thủ nguyên lý **Dependency Inversion (DIP)**: tầng dịch vụ chỉ phụ thuộc vào `interface` trừu tượng, không phụ thuộc lớp cài đặt cụ thể. |

---

## 3.4. Phân tích Sâu 2 Mẫu Thiết kế Hướng đối tượng (GoF Design Patterns)

### 3.4.1. Mẫu thiết kế Strategy Pattern trong Kiểm tra Nghiệp vụ Đăng ký (`com.courseregistration.service.policy`)
- **Bài toán đặt ra**: Khi sinh viên bấm đăng ký học phần (`UC01`) hoặc hệ thống xét đôn từ Danh sách chờ (`UC02`, `UC26`), hệ thống phải kiểm tra nối tiếp nhiều quy tắc học vụ (thời hạn đợt đăng ký, chống trùng môn, trần 20 tín chỉ, tiên quyết, học trước, song hành, chống trùng lịch). Nếu viết toàn bộ bằng chuỗi `if-else` khổng lồ trong `EnrollmentService.enroll()`, lớp dịch vụ sẽ phình to (*God Class*) và vi phạm nguyên lý Đóng/Mở (**OCP**).
- **Giải pháp OOP áp dụng**:
  - Định nghĩa giao diện chiến lược [`EnrollmentRule`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/policy/EnrollmentRule.java) nhận đối tượng ngữ cảnh bất biến [`EnrollmentValidationContext`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/policy/EnrollmentValidationContext.java).
  - Tách mỗi quy tắc thành một lớp độc lập gắn thứ tự ưu tiên `@Order`:
    1. [`SectionAvailabilityRule`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/policy/SectionAvailabilityRule.java) (`@Order(10)`): Kiểm tra lớp `OPEN`, không vướng cờ rà soát lịch và đợt đăng ký của học kỳ đang mở.
    2. [`DuplicateEnrollmentRule`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/policy/DuplicateEnrollmentRule.java) (`@Order(20)`): Chặn đăng ký lặp lớp hoặc trùng mã môn trong cùng học kỳ.
    3. [`CreditLimitRule`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/policy/CreditLimitRule.java) (`@Order(30)`): Đảm bảo tổng tín chỉ không vượt trần `maxCredits` (20 tín chỉ).
    4. [`PrerequisiteRule`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/policy/PrerequisiteRule.java) (`@Order(40)`) & [`CourseConditionRule`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/policy/CourseConditionRule.java) (`@Order(45)`): Kiểm tra đủ 3 loại điều kiện *Tiên quyết, Học trước, Song hành* thông qua [`CourseConditionEvaluator`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/policy/CourseConditionEvaluator.java).
    5. [`ScheduleConflictRule`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/policy/ScheduleConflictRule.java) (`@Order(50)`): Phát hiện giao thoa thứ/tiết/tuần học qua `SectionMeeting.overlaps()`.
- **Hiệu quả**: Khi nhà trường bổ sung quy định mới (ví dụ giới hạn tín chỉ theo mức GPA cảnh báo học vụ), lập trình viên chỉ cần thêm 1 lớp `@Component` mới cài đặt `EnrollmentRule` mà không cần sửa đổi bất kỳ dòng mã nào trong [`EnrollmentService`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/EnrollmentService.java).

### 3.4.2. Mẫu thiết kế Adapter Pattern trong Tích hợp Dịch vụ Chatbot AI (`com.courseregistration.service.chat`)
- **Bài toán đặt ra**: Hệ thống cần kết nối được cả các dịch vụ LLM đám mây chuẩn OpenAI (Google Gemini, Groq, OpenAI) lẫn máy chủ Chatbot riêng do thành viên trong nhóm tự xây dựng bằng Python FastAPI/Flask có cấu trúc JSON hoàn toàn khác nhau.
- **Giải pháp OOP áp dụng**:
  - Định nghĩa giao diện mục tiêu (*Target Interface*) [`AiProviderAdapter`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/chat/AiProviderAdapter.java) nhận gói dữ liệu chuẩn hóa [`AiChatExchange`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/chat/AiChatExchange.java).
  - Cài đặt 2 bộ chuyển đổi (*Concrete Adapters*):
    1. [`OpenAiCompatibleAiAdapter`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/chat/OpenAiCompatibleAiAdapter.java): Chuyển đổi `AiChatExchange` sang cấu trúc `messages[{role, content}]` chuẩn OpenAI Chat Completions (tự động nhận diện `GEMINI`, `GROQ`, `OPENAI_COMPATIBLE`).
    2. [`TeammateWebhookAiAdapter`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/chat/TeammateWebhookAiAdapter.java): Chuyển đổi `AiChatExchange` sang gói JSON `{message, history, verifiedContext, sources, student}` gửi tới Webhook của thành viên nhóm và trích xuất linh hoạt kết quả trả về.

---

## 3.5. Bảng Từ điển Lớp Thiết kế Cốt lõi (Class Dictionary)

| Nhóm kiến trúc | Tên lớp Java | Vai trò & Trách nhiệm chính | Thuộc tính & Phương thức tiêu biểu |
| :--- | :--- | :--- | :--- |
| **Thực thể Tổ chức & Hồ sơ** | [`Department`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/Department.java), [`AcademicProgram`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/AcademicProgram.java), [`AdministrativeClass`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/AdministrativeClass.java) | Quản lý phân cấp Khoa/Viện -> Ngành đào tạo -> Lớp hành chính khóa học. | `code`, `name`, `cohort`, `department`, `program` |
| **Thực thể Người học & Giảng dạy** | [`Student`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/Student.java), [`Lecturer`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/Lecturer.java) | Lưu trữ hồ sơ sinh viên, mã lớp hành chính, trạng thái học tập và hồ sơ giảng viên phụ trách. | `studentCode`, `lecturerCode`, `fullName`, `cohort`, `completedCourseCodes` |
| **Thực thể Học phần & Khung CT** | [`Course`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/Course.java), [`CourseCondition`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/CourseCondition.java), [`Curriculum`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/Curriculum.java), [`CurriculumCourse`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/CurriculumCourse.java) | Định nghĩa danh mục môn học, 3 loại điều kiện ràng buộc và cấu trúc môn học bắt buộc/tự chọn theo kỳ. | `credits`, `conditionType`, `isSatisfiedBy()`, `recommendedSemester`, `requiredCourse` |
| **Thực thể Học kỳ & Mở lớp** | [`Semester`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/Semester.java), [`RegistrationPeriod`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/RegistrationPeriod.java), [`CourseSection`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/CourseSection.java), [`SectionMeeting`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/SectionMeeting.java), [`TeachingPeriod`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/TeachingPeriod.java) | Quản lý thời gian học kỳ, cửa sổ mở đăng ký, sĩ số lớp học phần và thuật toán kiểm tra trùng ca/tuần học. | `getEffectiveStatus()`, `totalEnrolled()`, `overlaps()`, `hasValidTime()`, `summary()` |
| **Thực thể Đăng ký, Hàng chờ & Điểm** | [`Enrollment`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/Enrollment.java), [`WaitlistEntry`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/WaitlistEntry.java), [`AcademicResult`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/AcademicResult.java) | Ghi nhận trạng thái đăng ký (`ENROLLED`, `PENDING`, `CANCELLED`), hàng chờ FIFO và điểm tích lũy các kỳ. | `approve()`, `cancel()`, `reEnroll()`, `promote()`, `isPassed()`, `studiedBefore()` |
| **Thực thể Bảo mật & Kiểm toán** | [`UserAccount`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/UserAccount.java), [`PasswordResetToken`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/PasswordResetToken.java), [`RolePermission`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/RolePermission.java), [`AuditLog`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/AuditLog.java) | Xác thực tài khoản 4 vai trò, quản lý vòng đời mã OTP khôi phục mật khẩu, phân quyền động và lưu vết kiểm toán. | `role`, `status`, `recordFailedAttempt()`, `markUsed()`, `permission`, `details` |
| **Tầng Dịch vụ Nghiệp vụ** | [`EnrollmentService`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/EnrollmentService.java), [`TrainingManagementService`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/TrainingManagementService.java), [`StudentAcademicService`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/StudentAcademicService.java), [`ChatbotService`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/ChatbotService.java), [`AcademicChatService`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/AcademicChatService.java), [`PasswordResetService`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/PasswordResetService.java) | Điều phối giao dịch `@Transactional`, kiểm tra quy tắc học vụ, tính GPA tích lũy, duyệt `PENDING`, đôn hàng chờ, tư vấn AI và gửi OTP. | `enroll()`, `drop()`, `approvePendingEnrollment()`, `adminDropEnrollment()`, `respond()`, `requestReset()` |
