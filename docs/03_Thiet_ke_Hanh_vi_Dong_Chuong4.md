# Chương 4. Thiết kế Hành vi Động Hệ thống (Sequence, Activity & State Machine Diagrams — Việc 8)

> [!IMPORTANT]
> Toàn bộ **14 biểu đồ hành vi động chuẩn UML 2.5** trong Chương 4 được ánh xạ trực tiếp tới từng lời gọi phương thức, giao dịch `@Transactional`, khóa bi quan `PESSIMISTIC_WRITE`, thuật toán giao tập tuần học `SectionMeeting.overlaps()` và cơ chế tự động đôn Danh sách chờ FIFO trong mã nguồn thực tế của hệ thống `CourseBot`.
> Bộ ảnh `.png`, vector `.svg` và mã nguồn `.puml` gốc được lưu tại [`Chuong4_Behavioral_Diagrams/`](file:///E:/CODE/PTvTKHDT/S%C6%A1%20%C4%91%E1%BB%93/Chuong4_Behavioral_Diagrams).

---

## 4.1. Bộ 5 Biểu đồ Trình tự (Sequence Diagrams)

````carousel
![Hình 4.1. Sequence Diagram — Đăng nhập phân quyền & Khôi phục mật khẩu OTP 6 số (UC12 & UC13)](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/01_Seq_Auth_OTP_Reset.png)
<!-- slide -->
![Hình 4.2. Sequence Diagram — Đăng ký học phần, Kiểm tra 6 Chiến lược (Strategy) & Xếp hàng chờ FIFO (UC01)](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/02_Seq_Enroll_Strategy_Waitlist.png)
<!-- slide -->
![Hình 4.3. Sequence Diagram — Hủy học phần (7 ngày / Ngoại lệ), Chặn hủy môn Song hành & Tự động đôn Waitlist (UC02 & UC26)](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/03_Seq_Drop_And_Promote_Waitlist.png)
<!-- slide -->
![Hình 4.4. Sequence Diagram — Ban Đào tạo xếp lớp & Kiểm tra xung đột Phòng học / Giảng viên theo tuần (UC21)](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/04_Seq_Section_Schedule_Validation.png)
<!-- slide -->
![Hình 4.5. Sequence Diagram — Chatbot AI tư vấn học vụ kết hợp Ngữ cảnh CSDL xác thực & Adapter Pattern (UC10)](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/05_Seq_Chatbot_Verified_RAG_Adapter.png)
````

### Điểm nhấn Kỹ thuật trong Thiết kế Tương tác (Sequence Design Highlights)
- **Kiểm soát đồng thời bằng khóa bi quan (`PESSIMISTIC_WRITE`)**: Trong cả luồng đăng ký ([`EnrollmentService.enroll()`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/EnrollmentService.java#L104-L132)) và luồng hủy/duyệt ([`EnrollmentService.drop()`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/EnrollmentService.java#L135-L170), [`TrainingManagementService.approvePendingEnrollment()`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/TrainingManagementService.java)), hệ thống luôn gọi `findSectionForUpdate(sectionId)` đầu tiên để tuần tự hóa các giao dịch đồng thời trên cùng một lớp học phần.
- **Thuật toán kiểm tra xung đột lịch theo tập hợp tuần học**: Phương thức [`SectionMeeting.overlaps()`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/SectionMeeting.java#L56-L62) kết hợp 3 điều kiện: cùng `dayOfWeek` + giao khoảng giờ `[startsAt, endsAt)` + giao tập tuần học `parseWeeks(weeksExpression)` (`!Collections.disjoint(first, second)`). Nhờ đó, hai lớp học cùng phòng, cùng tiết nhưng một lớp học tuần `1-8` và một lớp học tuần `9-16` hoàn toàn không bị báo trùng oan!
- **Kiến trúc AI an toàn 2 pha (`Verified RAG -> Adapter`)**: [`ChatbotService.respond()`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/ChatbotService.java#L80-L109) luôn lấy dữ liệu gốc từ [`AcademicChatService`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/AcademicChatService.java) trước rồi mới truyền qua [`AiProviderAdapter`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/chat/AiProviderAdapter.java), đảm bảo ngay cả khi mạng đứt (`FALLBACK`), sinh viên vẫn nhận được số liệu tín chỉ và điều kiện môn chính xác tuyệt đối.

---

## 4.2. Bộ 5 Biểu đồ Hoạt động Phân làn (Swimlane Activity Diagrams)

````carousel
![Hình 4.6. Activity Diagram — Đăng nhập & Khôi phục mật khẩu qua Email OTP 6 số](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/06_Act_Auth_And_OTP_Reset.png)
<!-- slide -->
![Hình 4.7. Activity Diagram — Đăng ký học phần, Kiểm tra trùng lịch theo tuần & Hàng chờ FIFO](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/07_Act_Enroll_And_Week_Conflict.png)
<!-- slide -->
![Hình 4.8. Activity Diagram — Hủy học phần (7 ngày / Ngoại lệ) & Tự động đôn Danh sách chờ](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/08_Act_Drop_And_Auto_Promote.png)
<!-- slide -->
![Hình 4.9. Activity Diagram — Ban Đào tạo xếp lớp & Kiểm tra trùng Phòng / Giảng viên theo tuần](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/09_Act_Schedule_Section_Room_Lecturer.png)
<!-- slide -->
![Hình 4.10. Activity Diagram — Chatbot AI tư vấn học vụ an toàn (ONLINE / FALLBACK / LOCAL)](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/10_Act_Chatbot_Verified_RAG.png)
````

---

## 4.3. Bộ 4 Biểu đồ Máy trạng thái (State Machine Diagrams)

````carousel
![Hình 4.11. State Machine Diagram — Vòng đời Bản ghi Đăng ký (Enrollment)](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/11_State_Enrollment.png)
<!-- slide -->
![Hình 4.12. State Machine Diagram — Vòng đời Danh sách chờ FIFO (WaitlistEntry)](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/12_State_WaitlistEntry.png)
<!-- slide -->
![Hình 4.13. State Machine Diagram — Vòng đời Lớp học phần (CourseSection)](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/13_State_CourseSection.png)
<!-- slide -->
![Hình 4.14. State Machine Diagram — Vòng đời Khung chương trình đào tạo (Curriculum)](/C:/Users/nguye/.gemini/antigravity/brain/a1da8d3c-7d4c-4f4d-93ac-3c81320c372b/14_State_Curriculum.png)
````

---

## 4.4. Bảng Tổng hợp Chuyển đổi Trạng thái của 4 Thực thể Nghiệp vụ

| Thực thể | Tập trạng thái (`Enum`) | Các sự kiện & Điều kiện canh giữ (`[Guard]`) làm chuyển đổi trạng thái |
| :--- | :--- | :--- |
| **[`Enrollment`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/Enrollment.java)** | `PENDING`, `ENROLLED`, `CANCELLED` | • `[*] -> ENROLLED`: Đăng ký trực tiếp khi lớp còn chỗ trống hoặc được đôn từ `WaitlistEntry`.<br>• `[*] -> PENDING`: Nhập dữ liệu hồ sơ chờ xác nhận học vụ.<br>• `PENDING -> ENROLLED`: Ban Đào tạo gọi `approve()` `[sĩ số < capacity]`.<br>• `PENDING -> CANCELLED`: Ban Đào tạo từ chối hồ sơ.<br>• `ENROLLED -> CANCELLED`: Sinh viên gọi `drop()` `[trong 7 ngày đầu kỳ && không vi phạm môn Song hành]` hoặc Ban Đào tạo gọi `adminDropEnrollment()`.<br>• `CANCELLED -> ENROLLED`: Sinh viên đăng ký lại `reEnroll()` `[trong đợt mở && đủ điều kiện && còn chỗ]`. |
| **[`WaitlistEntry`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/WaitlistEntry.java)** | `WAITING`, `PROMOTED`, `CANCELLED` | • `[*] -> WAITING`: Sinh viên đăng ký lớp hợp lệ nhưng `[totalEnrolled >= capacity]`.<br>• `WAITING -> PROMOTED`: Lớp phát sinh ghế trống và ứng viên đầu hàng FIFO thỏa mãn `[canPromote() == true]` -> gọi `promote()` và tạo `Enrollment(ENROLLED)`.<br>• `WAITING -> CANCELLED`: Hủy yêu cầu chờ `cancel()`.<br>• `CANCELLED / PROMOTED -> WAITING`: Đăng ký chờ lại khi lớp đầy `rejoin()` (cập nhật `createdAt = now()` xếp cuối hàng). |
| **[`CourseSection`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/CourseSection.java)** | `OPEN` (*Available / Full / ReviewHold*), `CLOSED`, `CANCELLED` | • `[*] -> OPEN`: Mở lớp học phần mới không trùng lịch Phòng/Giảng viên.<br>• Nội trạng thái `OPEN`: chuyển qua lại giữa *Còn chỗ trống*, *Đầy sĩ số (kích hoạt Waitlist)* và *Tạm khóa rà soát lịch (`scheduleReviewRequired`)*.<br>• `OPEN <-> CLOSED`: Chốt lớp khi kết thúc đợt đăng ký hoặc mở bổ sung.<br>• `OPEN / CLOSED -> CANCELLED`: Hủy lớp `cancelSection()`, giải phóng phòng học và giảng viên. |
| **[`Curriculum`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/Curriculum.java)** | `DRAFT`, `ACTIVE`, `ARCHIVED` | • `[*] -> DRAFT`: Tạo dự thảo khung chương trình mới, thêm/bớt `CurriculumCourse`.<br>• `DRAFT -> ACTIVE`: Công bố áp dụng chính thức cho Ngành & Khóa đào tạo.<br>• `ACTIVE / DRAFT -> ARCHIVED`: Lưu trữ lịch sử phiên bản khi ban hành chương trình mới (bảo toàn đối chiếu cho sinh viên khóa cũ, không xóa vật lý). |
