# Cẩm nang Demo Trực tiếp, Dàn ý 15 Slide Thuyết trình & Hỏi đáp Bảo vệ Đồ án (CourseBot)

> [!TIP]
> Toàn bộ tài khoản, mật khẩu, mã học phần, mã lớp học phần và bản ghi chờ duyệt dưới đây đều **có sẵn thực tế 100%** trong cơ sở dữ liệu chuẩn hóa (`coursebot_academic_demo` / **Neon Cloud PostgreSQL**). Nhóm chỉ cần mở đúng tài khoản và gõ đúng mã bên dưới là tái hiện thành công ngay lần đầu trước Hội đồng chấm thi.

---

## Phần 1. Chuẩn bị 1 Phút Trước Giờ Bảo vệ & Danh sách Tài khoản Mẫu

### 1.1. Lệnh khởi động nhanh hệ thống

- **Cách 1 — Chạy trực tiếp trên Database Cloud Neon chung của nhóm (Khuyên dùng khi bảo vệ):**
  ```powershell
  .\run-cloud.ps1
  ```
  *(Mở trình duyệt tại `http://localhost:8080/login.html`. Các biến `DATABASE_URL`, `AI_PROVIDER`, `AI_API_KEY`, `SMTP_*` trong `.env` được nạp tự động qua `DotEnvEnvironmentPostProcessor`.)*

- **Cách 2 — Chạy dự phòng Offline bằng PostgreSQL trên máy cá nhân (nếu phòng thi mất mạng Internet):**
  ```powershell
  $env:DB_PASSWORD = 'MatKhauPostgresLocalCuaBan'
  .\run-academic-demo.ps1
  ```
  *(Mở trình duyệt tại `http://localhost:8084/login.html` — dữ liệu giống hệt 100% trên Neon Cloud, Chatbot tự động chuyển mượt sang chế độ `LOCAL` / `FALLBACK` không bao giờ treo lỗi.)*

- **Mẹo mở 2 cửa sổ trình duyệt song song khi Demo:**
  - **Cửa sổ 1 (Thường):** Đăng nhập **Ban Đào tạo** (`academic_training`) hoặc **Quản trị viên** (`admin`).
  - **Cửa sổ 2 (Ẩn danh / Incognito):** Đăng nhập **Sinh viên** (`24it001@sv.demo.edu.vn` / `25it001@sv.demo.edu.vn`).

### 1.2. Bảng Tài khoản Thực tế theo 4 Vai trò RBAC

> Mật khẩu mặc định thống nhất cho toàn bộ **113 tài khoản** trong bộ dữ liệu học vụ: **`AcademicDemo2026!`**

| Vai trò RBAC | Tên đăng nhập (`username`) | Mật khẩu | Hồ sơ gắn kết & Mục đích sử dụng trong buổi Demo |
| :--- | :--- | :--- | :--- |
| **Ban Đào tạo** | `academic_training` | `AcademicDemo2026!` | Mở đợt đăng ký kỳ `2026-2027-1`, xếp lớp kiểm tra trùng phòng/GV theo tuần, duyệt đơn `PENDING`, hủy ngoại lệ quá hạn 7 ngày & xuất báo cáo. |
| **Sinh viên 1 (Khóa 24)** | `24it001@sv.demo.edu.vn` | `AcademicDemo2026!` | Mã SV `24IT001` (Ngành CNTT, Đang học) — xem Bảng điểm GPA + xuất CSV, đang có sẵn đơn `PENDING` môn `INF301.2627.1.01`, hỏi Chatbot AI cá nhân hóa. |
| **Sinh viên 2 (Khóa 25)** | `25it001@sv.demo.edu.vn` | `AcademicDemo2026!` | Mã SV `25IT001` (Ngành CNTT) — dùng để test trực tiếp chặn **Trùng lịch theo tuần**, chặn **Tiên quyết / Học trước / Song hành** và **Waitlist FIFO**. |
| **Sinh viên 3 (Cảnh báo HV)** | `24it002@sv.demo.edu.vn` | `AcademicDemo2026!` | Mã SV `24IT002` (Cảnh báo học vụ, có môn học lại) — minh họa bảng điểm lưu lịch sử học lại và đơn `PENDING` môn `INF402.2627.1.01`. |
| **Giảng viên** | `tuannm@demo.edu.vn` | `AcademicDemo2026!` | Mã GV `GV001` (Khoa CNTT) — xem thời khóa biểu giảng dạy kỳ `2026-2027-1`, lọc danh sách sinh viên lớp phụ trách & xuất CSV. |
| **Quản trị viên** | `admin` | `AcademicDemo2026!` | Quản lý tài khoản, bật/tắt ma trận quyền động RBAC (`role_permissions`) và kiểm tra Nhật ký kiểm toán (`audit_logs`). |

---

## Phần 2. Kịch bản Demo Live 7 Phút (7 Cảnh Liên Hoàn — Khớp Sát Mã Nguồn & UML)

> [!IMPORTANT]
> **Lưu ý vàng ở Cảnh 1:** Trong bộ dữ liệu gốc, học kỳ `2026-2027-1` có hạn đóng đăng ký gốc là `13/09/2026`. Vì vậy, bắt đầu bài Demo bằng thao tác **Ban Đào tạo mở lại đợt đăng ký cho kỳ `2026-2027-1`** vừa trình diễn được `UC14/UC15`, vừa mở khóa cho các cảnh Sinh viên đăng ký ngay sau đó!

### Cảnh 1 (01 phút) — Ban Đào tạo Mở Đợt Đăng ký & Xếp lớp Kiểm tra Trùng Phòng / Giảng viên theo Tuần (`UC14`, `UC15`, `UC17`)
1. Tại **Cửa sổ 1**, đăng nhập `academic_training` / `AcademicDemo2026!` -> Hệ thống điều hướng vào cổng `workspace.html`.
2. Vào mục **Học kỳ / Đợt đăng ký**, chọn học kỳ **`2026-2027-1`** (`Học kỳ 1 năm học 2026-2027`) -> Bật **Mở đăng ký liên tục** (hoặc gia hạn ngày kết thúc đợt đăng ký qua thời điểm hiện tại) -> Lưu thành công.
3. Chuyển sang mục **Lớp học phần**, minh họa thuật toán `SectionMeeting.overlaps()` theo tuần:
   - Hiện tại lớp `INF303.2627.1.01` (*Phân tích thiết kế hệ thống*) đang học **Thứ 2, Tiết 1–3, Phòng `A101`, Tuần `1-15`**.
   - Thử tạo/sửa một lớp học phần vào **Thứ 2, Tiết 2–4, Phòng `A101`, Tuần `5-10`** -> Hệ thống **chặn ngay lập tức** và chỉ rõ xung đột phòng `A101` ở các tuần `5..10`.
   - Đổi biểu thức tuần học thành **`16-18`** (vẫn Thứ 2, Tiết 2–4, Phòng `A101`) -> Hệ thống **cho phép lưu thành công** vì tập tuần không giao nhau!

### Cảnh 2 (01 phút 30 giây) — Sinh viên Xem Bảng điểm GPA & Kiểm chứng Chuỗi 6 Strategy Rules (`UC25`, `UC01`)
1. Tại **Cửa sổ 2 (Ẩn danh)**, đăng nhập `24it001@sv.demo.edu.vn` / `AcademicDemo2026!` -> Mở mục **Kết quả học tập / Bảng điểm**:
   - Trình chiếu điểm tổng kết qua các học kỳ, tổng số tín chỉ tích lũy, điểm trung bình GPA và bấm **Xuất CSV** tải bảng điểm về máy (`UC25`).
2. Chuyển sang tài khoản `25it001@sv.demo.edu.vn` (`25IT001`) để trình diễn **Strategy Pattern (`EnrollmentRule`)** chặn chính xác từng vi phạm:
   - **Test Trùng lịch theo tuần (`ScheduleConflictRule`):** `25IT001` đang học `LAW101.2627.1.01` (*Thứ 5, Tiết 10–11, Tuần 1–15*). Tìm lớp **`HIS101.2627.1.01`** (*Lịch sử Đảng*, cũng *Thứ 5, Tiết 10–11, Tuần 1–15*) bấm **Đăng ký** -> Bị chặn tức thì kèm thông báo trùng lịch chi tiết!
   - **Test Điều kiện Tiên quyết (`PREREQUISITE`):** Tìm lớp **`SWE301.2627.1.01`** (*Nhập môn CNPM* — yêu cầu Đạt môn Tiên quyết `INF302 - Lập trình hướng đối tượng`) bấm **Đăng ký** -> Bị chặn do chưa tích lũy đạt `INF302`.
   - **Test Điều kiện Học trước (`PREVIOUS`):** Tìm lớp **`PED102.2627.1.01`** (*GDTC 2* — yêu cầu Học trước `PED101`) hoặc **`POL101.2627.1.01`** (*KTCT Mác–Lênin* — yêu cầu Học trước `PHI101`) -> Giải thích với Hội đồng điểm khác biệt cốt lõi trong `CourseCondition.isSatisfiedBy()`: *Tiên quyết bắt buộc `PASSED`, còn Học trước chỉ cần đã từng học và có kết quả trong `academic_results`*.
   - **Test Điều kiện Song hành (`COREQUISITE`) & Chặn hủy ngược:**
     - Bấm đăng ký **`ENL103.2627.1.01`** (*Ngữ âm – Âm vị học*) khi chưa đăng ký `ENL101` -> Hệ thống báo thiếu môn Song hành `ENL101 - Nghe – Nói 1`.
     - Đăng ký **`ENL101.2627.1.01`** trước -> Quay lại bấm đăng ký **`ENL103.2627.1.01`** -> **Thành công ngay trong cùng học kỳ!**

### Cảnh 3 (01 phút 30 giây) — Hạn Hủy 7 Ngày, Duyệt `PENDING`, Hủy Ngoại lệ & Tự động Đôn `Waitlist` (`UC02`, `UC03`, `UC26`)
1. Trên màn hình Sinh viên, thử bấm **Hủy** môn **`ENL101.2627.1.01`** trong khi vẫn giữ `ENL103` (hoặc thử hủy môn khi học kỳ `2026-2027-1` đã qua mốc 7 ngày kể từ `starts_at = 01/09/2026`):
   - Hệ thống chặn bảo vệ ràng buộc **Song hành ngược** và quy định **chỉ tự hủy trong 7 ngày đầu học kỳ**, đồng thời hướng dẫn liên hệ Ban Đào tạo.
2. Quay sang **Cửa sổ 1 (`academic_training`)**, mở mục **Quản lý Ghi danh / Duyệt đăng ký (`UC26`)**:
   - Lọc trạng thái **`PENDING`**: Hiển thị danh sách 22 bản ghi chờ xác nhận, chọn đơn của sinh viên **`24IT001` — lớp `INF301.2627.1.01` (*Hệ điều hành*)** -> Bấm **Duyệt (`Approve`)** -> Sinh viên `24IT001` chuyển sang `ENROLLED` ngay lập tức (kiểm tra lại bên Cửa sổ 2 thấy lịch học cập nhật tức thời).
3. Minh họa **Hàng chờ FIFO (`WaitlistEntry`) & Tự động đôn chỗ (`promoteFromWaitlist`)**:
   - Ban Đào tạo đặt `capacity` của một lớp mở bằng đúng sĩ số hiện tại (lớp đầy) -> Sinh viên A bấm đăng ký được đưa vào **Danh sách chờ (`WAITING`, vị trí #1)**.
   - Ban Đào tạo bấm **Hủy ngoại lệ (`adminDrop`)** cho 1 sinh viên đang học trong lớp đó -> Hệ thống giải phóng 1 ghế và **tự động đôn Sinh viên A từ `WAITING` lên `ENROLLED`** trong cùng một giao dịch `@Transactional` có khóa bi quan `PESSIMISTIC_WRITE`!

### Cảnh 4 (01 phút) — Chatbot Tư vấn Học vụ AI Chống Ảo giác (`UC10` — Adapter Pattern)
1. Tại Cửa sổ Sinh viên (`24it001@sv.demo.edu.vn`), mở khung **Chatbot Học vụ CourseBot** và gửi lần lượt 3 câu hỏi:
   - `Bảng điểm và GPA tích lũy hiện tại của mình là bao nhiêu?`
   - `Điều kiện để đăng ký môn Trí tuệ nhân tạo INF401 và môn Ngữ âm ENL103 là gì?` *(Chatbot liệt kê chính xác cả Tiên quyết `INF201`, Học trước `MAT201` và Song hành `ENL101` từ CSDL!)*
   - `Học kỳ này mình còn thiếu những môn nào trong chương trình đào tạo và lớp nào chưa trùng lịch?`
2. Nhấn mạnh với Hội đồng: hệ thống hiển thị rõ nhãn chế độ (`ONLINE` khi nối Gemini/Groq hoặc Webhook của bạn cùng nhóm qua `AiProviderAdapter`; tự động hạ cấp về `FALLBACK` / `LOCAL` trong 12 giây nếu đứt mạng mà số liệu tín chỉ/điểm số vẫn chính xác 100%).

### Cảnh 5 (01 phút) — Quên mật khẩu Email OTP 6 số thật (`UC06`)
1. Mở `/forgot-password.html`, nhập địa chỉ email đã gắn với tài khoản test -> Hệ thống sinh mã OTP 6 chữ số ngẫu nhiên (`SecureRandom`), lưu bản băm `SHA-256` vào bảng `password_reset_tokens` (hạn 10 phút, tối đa 5 lần nhập sai) và gửi email qua `smtp.gmail.com:587`.
2. Mở hộp thư Gmail chiếu trực tiếp mã OTP 6 số vừa nhận -> Nhập OTP và đặt mật khẩu mới thành công tại `/reset-password.html`.

### Cảnh 6 (30 giây) — Cổng Giảng viên xem Lịch dạy & Danh sách Lớp (`UC11`–`UC13`)
1. Đăng nhập `tuannm@demo.edu.vn` / `AcademicDemo2026!` -> Chọn kỳ `2026-2027-1` -> Xem lịch giảng dạy được phân công, bấm vào lớp phụ trách để tìm kiếm sinh viên và xuất danh sách điểm danh ra file `.csv`.

### Cảnh 7 (30 giây) — Cổng Quản trị viên Phân quyền Động RBAC & Nhật ký Kiểm toán (`UC21`–`UC24`)
1. Đăng nhập `admin` / `AcademicDemo2026!` -> Mở tab **Phân quyền** (`role_permissions`) và tab **Nhật ký hệ thống** (`audit_logs`) -> Cho Hội đồng thấy toàn bộ các hành động vừa thực hiện ở Cảnh 1–5 (mở đợt đăng ký, duyệt `PENDING`, hủy ngoại lệ, đặt lại mật khẩu) đều đã được ghi vết thời gian thực kèm người thực hiện (`actor`) và đối tượng tác động (`target`)!

---

## Phần 3. Dàn ý Chi tiết 15 Slide Thuyết trình Bảo vệ Bài tập lớn (12–15 Phút)

> [!NOTE]
> File PowerPoint chuẩn màn hình rộng 16:9 đã được khởi tạo sẵn tại [Slide_Bao_ve_PTvTKHDT_CourseBot_15Slides.pptx](file:///E:/CODE/PTvTKHDT/Slide_Bao_ve_PTvTKHDT_CourseBot_15Slides.pptx) kèm sẵn hình ảnh sơ đồ UML/ERD nét cao và phần ghi chú thuyết trình (`Speaker Notes`) dưới mỗi slide.

| Slide | Tiêu đề Slide | Nội dung cốt lõi trên Slide | Sơ đồ / Minh họa nhúng kèm | Thời lượng |
| :---: | :--- | :--- | :--- | :---: |
| **01** | Trang bìa Đồ án PT&TKHĐT | Đề tài: **Phân tích & Thiết kế Hệ thống Đăng ký Học phần Ứng dụng Chatbot AI (CourseBot)** — Thông tin Nhóm, GVHD, Công nghệ (`Java 21`, `Spring Boot 3.5`, `PostgreSQL 16 / Neon`, `UML 2.5`). | Logo trường + Sơ đồ tổng quan kiến trúc thu nhỏ | 30s |
| **02** | Bài toán Thực tế & Mục tiêu Hệ thống | 4 thách thức của hệ thống ĐKHP truyền thống: (1) Nghẽn & vượt sĩ số giờ cao điểm, (2) Kiểm tra thiếu điều kiện Học trước / Song hành & trùng lịch tuần lẻ/chẵn, (3) Xử lý thủ công khi lớp đầy hoặc quá hạn hủy, (4) Sinh viên thiếu công cụ tư vấn lộ trình cá nhân hóa chính xác. | Bảng đối chiếu Hiện trạng vs Giải pháp CourseBot | 45s |
| **03** | Phạm vi Hệ thống & Danh sách Tác nhân (SRS) | 04 Tác nhân chính (`Sinh viên`, `Giảng viên`, `Ban Đào tạo`, `Quản trị viên`) + 03 Tác nhân phụ tích hợp (`Cloud LLM / Custom Webhook AI`, `Gmail SMTP`, `Neon PostgreSQL`); Yêu cầu phi chức năng (RBAC, CSRF, BCrypt, SHA-256 OTP, Pessimistic Lock). | Bảng phân vai trò RBAC | 45s |
| **04** | Mô hình Use Case Tổng quát (26 Use Cases) | Phân rã 26 Use Case (`UC01`–`UC26`) theo 4 phân hệ nghiệp vụ; làm rõ các quan hệ `<<include>>` và `<<extend>>` chuẩn UML 2.5 (bổ sung `UC25` Xem/Xuất Bảng điểm và `UC26` Duyệt `PENDING` & Hủy ngoại lệ). | `00_UseCase_Tong_Quat_26UC.png` | 1p |
| **05** | Mô hình Lớp Phân tích Miền Nghiệp vụ (Domain Model) | 20 lớp khái niệm thuộc 5 miền học vụ; nhấn mạnh quan hệ `Composition` (`CourseSection ◆── SectionMeeting`), `Reflexive Association` (`Course ── CourseCondition`) và `Association Class` (`Enrollment`, `WaitlistEntry`, `AcademicResult`). | `01_Domain_Model_Phan_Tich.png` | 1p |
| **06** | Biểu đồ Lớp Thiết kế Thực thể (Rich Domain Model) | Chuyển hóa từ Anemic sang **Rich Domain Model**: đóng gói hành vi ngay trong thực thể (`SectionMeeting.overlaps()`, `CourseCondition.isSatisfiedBy()`, `Enrollment.approve()/cancel()`, `RegistrationPeriod.getEffectiveStatus()`). | `02_Design_Class_Entity_Diagram.png` | 1p |
| **07** | Áp dụng Mẫu Thiết kế GoF #1 — Strategy Pattern | Giải quyết bài toán kiểm tra đăng ký học phần phức tạp bằng giao diện `EnrollmentRule` và 6 chiến lược độc lập theo `@Order(10..50)`, tuân thủ tuyệt đối **Open/Closed Principle (OCP)** & **Single Responsibility Principle (SRP)**. | `03_Design_Class_Strategy_Enrollment.png` | 1p 15s |
| **08** | Áp dụng Mẫu Thiết kế GoF #2 — Adapter Pattern | Giao diện `AiProviderAdapter` tách rời `ChatbotService` khỏi nhà cung cấp AI: kết nối linh hoạt `OpenAiCompatibleAiAdapter` (Gemini / Groq / OpenAI) và `TeammateWebhookAiAdapter` (Server Chatbot riêng của thành viên nhóm). | `04_Design_Class_Adapter_Chatbot_Auth.png` | 1p |
| **09** | Thiết kế Tương tác — Sequence Diagram Đăng ký & Khóa Bi quan | Luồng `enroll()`: Khóa dòng `PESSIMISTIC_WRITE` -> Chuỗi 6 `EnrollmentRule` -> Kiểm tra đủ 3 điều kiện (Tiên quyết, Học trước, Song hành) & giao thoa tuần học -> Ghi danh `ENROLLED` hoặc xếp hàng chờ FIFO `WaitlistEntry`. | `02_Seq_Enroll_Strategy_Waitlist.png` | 1p |
| **10** | Thiết kế Tương tác — Hủy môn & Tự động Đôn Waitlist FIFO | Luồng `drop()` / `adminDrop()`: Kiểm tra cửa sổ 7 ngày đầu kỳ + Chặn hủy ngược môn Song hành -> Thu hồi ghế -> Duyệt FIFO `WaitlistEntry`, tái kiểm tra đủ 6 luật trước khi đôn lên `ENROLLED`. | `03_Seq_Drop_And_Promote_Waitlist.png` | 45s |
| **11** | Thiết kế Luồng Nghiệp vụ & Chatbot Verified RAG | Cơ chế **Verified Database Context + LLM Rephrasing**: Truy vấn sự thật học vụ từ 20 JPA Repositories trước khi gọi AI; cơ chế tự động hạ cấp `ONLINE -> FALLBACK -> LOCAL` chống ảo giác 100%. | `05_Seq_Chatbot_Verified_RAG_Adapter.png` | 45s |
| **12** | Biểu đồ Hoạt động Phân làn & Máy Trạng thái (State Machine) | Đối chiếu luồng phân làn kiểm tra xung đột lịch và vòng đời trạng thái chặt chẽ của 4 thực thể cốt lõi (`Enrollment`, `WaitlistEntry`, `CourseSection`, `Curriculum`). | `07_Act_Enroll_And_Week_Conflict.png` & `11_State_Enrollment.png` | 45s |
| **13** | Kiến trúc Thành phần & Triển khai Đám mây (Chương 5) | Kiến trúc 4 tầng tường minh (`Component Diagram`) và mô hình triển khai thực tế trên `OpenJDK 21` + `Neon Serverless PostgreSQL 16 (TLS 1.3)` + `Gmail SMTP STARTTLS` (`Deployment Diagram`). | `01_Arch_Component_Diagram.png` & `02_Arch_Deployment_Diagram.png` | 45s |
| **14** | Thiết kế CSDL Vật lý 25 Bảng PostgreSQL & Kiểm thử JUnit | Lược đồ ERD 25 bảng (3.196 bản ghi chuẩn hóa, 14 `UNIQUE`, 20 `FK`, 7 `CHECK`, B-Tree Index) và kết quả vượt qua **46/46 kịch bản kiểm thử tự động JUnit 5**. | `03_ERD_Master_25_Tables.png` | 45s |
| **15** | Demo Trực tiếp Hệ thống, Kết luận & Hướng Phát triển | Chuyển sang màn hình Live Demo 7 phút -> Tổng kết đóng góp OOAD của đồ án & 3 hướng mở rộng (Thanh toán học phí VietQR, WebSocket Push khi đôn Waitlist, Xếp TKB tự động đa mục tiêu). | Tóm tắt 4 điểm sáng công nghệ + Lời cảm ơn | 30s (+ Demo) |

---

## Phần 4. Bộ 08 Câu hỏi Phản biện Vấn đáp Hội đồng Thường Hỏi & Đáp Án Chuẩn OOAD

1. **Câu hỏi 1: Tại sao nhóm lại dùng *Strategy Pattern* cho nghiệp vụ đăng ký học phần mà không viết các hàm `if-else` trực tiếp trong `EnrollmentService`?**
   - **Trả lời chuẩn:** Nếu viết gộp toàn bộ 6 kiểm tra (mở đợt, trùng môn, trần 20 tín chỉ, tiên quyết, 3 loại điều kiện học phần, trùng lịch theo tuần) vào `EnrollmentService.enroll()`, phương thức sẽ phình to hàng trăm dòng và vi phạm nguyên lý **Đóng/Mở (OCP)**: mỗi khi nhà trường thêm quy định mới (ví dụ: nợ học phí không được đăng ký, hoặc giới hạn tín chỉ riêng cho sinh viên cảnh báo học vụ), ta buộc phải sửa trực tiếp lớp lõi dễ gây lỗi hồi quy. Với giao diện [`EnrollmentRule`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/policy/EnrollmentRule.java) và `@Order`, ta chỉ cần tạo thêm 1 lớp `@Component` mới cài đặt `EnrollmentRule`, Spring tự động tiêm vào danh sách kiểm tra mà không chạm tới một dòng code nào của `EnrollmentService`.

2. **Câu hỏi 2: Hai sinh viên cùng bấm vào 1 chỗ trống cuối cùng của lớp học phần ở cùng một mili-giây thì hệ thống xử lý thế nào để không bị vượt sĩ số (`41/40`)?**
   - **Trả lời chuẩn:** Nhóm giải quyết ngay ở tầng CSDL bằng khóa bi quan [`CourseSectionRepository.findByIdForUpdate()`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/repository/CourseSectionRepository.java) sử dụng `@Lock(LockModeType.PESSIMISTIC_WRITE)`. Trên PostgreSQL, Hibernate sinh câu lệnh `SELECT ... FOR NO KEY UPDATE`: giao dịch thứ nhất giữ khóa dòng của `course_sections`, giao dịch thứ hai buộc phải đợi đến khi giao dịch thứ nhất tăng sĩ số lên `40/40` và `COMMIT` xong. Khi giao dịch thứ hai đọc lại, lớp đã đầy nên hệ thống tự động từ chối ghi danh chính thức và mời sinh viên vào `WaitlistEntry`.

3. **Câu hỏi 3: Phân biệt rõ 3 loại điều kiện môn học (*Tiên quyết*, *Học trước*, *Song hành*) trong thiết kế lớp của nhóm? Nếu sinh viên đăng ký 2 môn Song hành rồi hủy môn điều kiện thì sao?**
   - **Trả lời chuẩn:** Trong [`CourseCondition`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/CourseCondition.java) và [`CourseConditionEvaluator`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/policy/CourseConditionEvaluator.java):
     - **Tiên quyết (`PREREQUISITE`)**: Sinh viên bắt buộc đã học và **Đạt (`PASSED`)** môn điều kiện ở các kỳ trước.
     - **Học trước (`PREVIOUS`)**: Sinh viên chỉ cần đã từng học và có kết quả trong bảng `academic_results` (dù `PASSED` hay `FAILED` đều thỏa mãn vì đã tiếp cận kiến thức nền).
     - **Song hành (`COREQUISITE`)**: Sinh viên đã đạt môn điều kiện **hoặc** đang có bản ghi `ENROLLED` của môn điều kiện ngay trong cùng học kỳ hiện tại. Đặc biệt, khi hủy môn (`EnrollmentService.drop`), hệ thống thực hiện **kiểm tra Song hành ngược (`validateReverseCorequisitesOnDrop`)**: nếu môn định hủy đang là điểm tựa Song hành cho một môn khác đang học trong kỳ, hệ thống chặn hủy để không phá vỡ tính toàn vẹn!

4. **Câu hỏi 4: Trạng thái `PENDING` trong bảng `enrollments` khác gì với trạng thái `WAITING` trong bảng `waitlist_entries`? Tại sao không gộp làm một bảng?**
   - **Trả lời chuẩn:** Hai khái niệm này có bản chất nghiệp vụ và vòng đời máy trạng thái hoàn toàn khác nhau:
     - `Enrollment(PENDING)` là đơn đăng ký **chờ Ban Đào tạo xét duyệt thủ công** (ví dụ đăng ký ngoại lệ, sinh viên diện cảnh báo học vụ cần cố vấn/phòng đào tạo xác nhận qua `UC26`).
     - `WaitlistEntry(WAITING)` là **hàng đợi tự động FIFO khi lớp hết chỗ (`40/40`)**: ngay khi có bất kỳ sinh viên nào hủy môn làm trống ghế, hệ thống tự động quét theo `created_at ASC` để đôn lên `ENROLLED` mà không cần con người can thiệp. Tách riêng 2 thực thể giúp tuân thủ **Single Responsibility Principle** và giữ ràng buộc `UNIQUE(student_id, section_id)` rõ ràng cho từng vòng đời.

5. **Câu hỏi 5: Thuật toán kiểm tra trùng lịch của nhóm xử lý ra sao với các lớp học cách tuần (ví dụ lớp A học tuần `1-8`, lớp B cùng Thứ và cùng Tiết nhưng học tuần `9-15`)?**
   - **Trả lời chuẩn:** Hệ thống không chỉ so sánh chuỗi Thứ/Tiết đơn thuần mà mô hình hóa thực thể [`SectionMeeting`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/entity/SectionMeeting.java) lưu biểu thức tuần `weeks_expression` (hỗ trợ cả dải tuần `1-8`, danh sách rời rạc `1,3,5,7` hoặc toàn kỳ). Phương thức `SectionMeeting.overlaps()` kiểm tra đồng thời 3 điều kiện giao nhau: **Cùng Thứ (`dayOfWeek`) $\land$ Giao khoảng tiết/giờ $\land$ Giao tập hợp các tuần thực học**. Do `{1..8} ∩ {9..15} = ∅`, hai lớp trên hoàn toàn hợp lệ cả khi sinh viên đăng ký lẫn khi Ban Đào tạo xếp chung một phòng học!

6. **Câu hỏi 6: Làm sao nhóm đảm bảo Chatbot AI không bịa đặt (*hallucination*) số tín chỉ, điều kiện tiên quyết hay điểm GPA của sinh viên? Và nếu tích hợp Chatbot riêng của bạn khác trong nhóm thì phải sửa bao nhiêu file?**
   - **Trả lời chuẩn:** Nhóm áp dụng kiến trúc **Verified Database Context + Adapter Pattern**:
     - Trước hết, [`AcademicChatService`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/AcademicChatService.java) truy vấn trực tiếp 100% số liệu thật từ PostgreSQL qua JPA Repositories để tạo câu trả lời gốc chuẩn xác. LLM chỉ đóng vai trò diễn đạt tự nhiên dựa trên ngữ cảnh khóa chặt đó; nếu LLM lỗi hoặc timeout quá 12 giây, hệ thống tự trả về câu trả lời xác thực nội bộ (`FALLBACK`).
     - Nhờ giao diện [`AiProviderAdapter`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/chat/AiProviderAdapter.java) và lớp [`TeammateWebhookAiAdapter`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/chat/TeammateWebhookAiAdapter.java), khi ghép với server Chatbot của bạn cùng nhóm, **không phải sửa bất kỳ dòng code Java nào** — chỉ cần đổi 2 dòng trong `.env` (`AI_PROVIDER=CUSTOM_WEBHOOK` và `AI_API_URL=http://.../api/chat`).

7. **Câu hỏi 7: Quy trình Quên mật khẩu qua OTP đảm bảo an toàn bảo mật như thế nào trước tấn công dò tài khoản (*User Enumeration*) và vét cạn mã OTP (*Brute-force*)?**
   - **Trả lời chuẩn:** Trong [`PasswordResetService`](file:///e:/CODE/PTvTKHDT/Code%20Project/src/main/java/com/courseregistration/service/PasswordResetService.java): (1) API `/api/auth/forgot-password` luôn trả về cùng một thông điệp trung lập dù email có tồn tại hay không (chống dò tài khoản); (2) Mã OTP 6 số sinh bằng `SecureRandom` không bao giờ lưu bản rõ mà được băm một chiều `SHA-256` trước khi lưu vào cột `token_hash`; (3) Token tự hết hạn sau **10 phút**, chỉ dùng được **1 lần duy nhất (`used_at`)** và tự động vô hiệu hóa ngay khi nhập sai quá **5 lần (`attempts`)**.

8. **Câu hỏi 8: Tại sao trong biểu đồ Use Case lại tuyệt đối không có mũi tên hai chiều `<--extend-->` như các công cụ vẽ tự động bằng AI thường sinh ra?**
   - **Trả lời chuẩn:** Theo đặc tả **OMG UML 2.5**, cả `<<include>>` và `<<extend>>` đều là quan hệ phụ thuộc một chiều có hướng (`Directed Dependency` nét đứt mũi tên hở):
     - Với `<<include>>`: mũi tên trỏ từ **Base Use Case sang Included Use Case** (luôn luôn thực thi).
     - Với `<<extend>>`: mũi tên trỏ từ **Extending Use Case quay về Base Use Case** (chỉ thực thi có điều kiện tại điểm mở rộng). Mũi tên hai chiều là lỗi cú pháp UML điển hình của ảnh sinh tự động, do đó toàn bộ 23 biểu đồ của nhóm đều được đặc tả bằng mã nguồn PlantUML chuẩn hóa để đảm bảo đúng ngữ nghĩa UML 2.5 tuyệt đối.
