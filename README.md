# CourseBot — Hệ thống đăng ký học phần

## Tài khoản đăng nhập kiểm thử (Web Cloud / Neon Database)

Hệ thống sử dụng cơ sở dữ liệu học vụ thực tế chuẩn hóa (gồm 90 sinh viên, 21 giảng viên, 73 học phần và 52 lớp học phần). Mật khẩu mặc định thống nhất: **`AcademicDemo2026!`**

| Vai trò | Tên đăng nhập | Mật khẩu | Mục đích kiểm thử / Demo |
| --- | --- | --- | --- |
| **Ban Đào tạo** | `academic_training` | `AcademicDemo2026!` | Mở đợt ĐK kỳ 2026-2027-1, xếp lớp kiểm tra trùng phòng/GV theo tuần, duyệt 22 đơn `PENDING` & hủy môn hộ sinh viên quá hạn 7 ngày. |
| **Sinh viên (K24)** | `24it001@sv.demo.edu.vn` | `AcademicDemo2026!` | Mã SV `24IT001`: Xem Bảng điểm GPA + xuất CSV, theo dõi đơn `PENDING` môn `INF301.2627.1.01`, hỏi Chatbot Học vụ AI. |
| **Sinh viên (K25)** | `25it001@sv.demo.edu.vn` | `AcademicDemo2026!` | Mã SV `25IT001`: Kiểm chứng chặn Trùng lịch tuần (`HIS101` vs `LAW101`), chặn Tiên quyết (`SWE301`), Học trước (`PED102`), Song hành (`ENL103` + `ENL101`). |
| **Giảng viên** | `tuannm@demo.edu.vn` | `AcademicDemo2026!` | Mã GV `GV001`: Xem lịch giảng dạy theo kỳ, lọc/tìm kiếm danh sách sinh viên lớp phụ trách & xuất file CSV. |
| **Quản trị viên** | `admin` | `AcademicDemo2026!` | Quản trị tài khoản, bật/tắt ma trận phân quyền động RBAC (`role_permissions`) & tra cứu nhật ký kiểm toán (`audit_logs`). |

*(Toàn bộ 90 sinh viên và 21 giảng viên trong hệ thống đều đăng nhập bằng email tương ứng trong danh sách, ví dụ `24it002@sv.demo.edu.vn`, `hattt@demo.edu.vn`... với mật khẩu `AcademicDemo2026!`).*

CourseBot là ứng dụng web đăng ký học phần viết bằng Java 21, Spring Boot, Spring Security, Spring Data JPA và **PostgreSQL**. Giao diện được chia theo vai trò sinh viên, giảng viên, Ban Đào tạo và quản trị viên. Dữ liệu nghiệp vụ được lưu trong PostgreSQL; cấu hình mặc định kết nối tới `jdbc:postgresql://localhost:5432/coursebot` (tự động tạo database nếu chưa tồn tại).

## Chạy chung Database Online qua 1 đường link (Neon / Supabase)

Không cần cài PostgreSQL trên máy, các thành viên trong nhóm có thể dùng chung cùng một database Cloud theo thời gian thực chỉ bằng đường link `postgresql://...`:

```powershell
# Lần đầu tiên: truyền link (hoặc chạy .\run-cloud.ps1 rồi dán link khi được hỏi — link sẽ tự lưu vào .env)
.\run-cloud.ps1 -DatabaseUrl 'postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'

# Từ các lần sau (hoặc chạy trực tiếp từ IntelliJ / VS Code khi đã có file .env):
.\run-cloud.ps1
```

File `.env` đã được đưa vào `.gitignore` để không lộ mật khẩu lên GitHub.

## Chạy với PostgreSQL trên máy (Local Windows)

Cần JDK 21 và dịch vụ PostgreSQL đang chạy (ví dụ PostgreSQL 18 tại `localhost:5432`). Maven Wrapper tự tải Maven ở lần chạy đầu tiên.

```powershell
$env:DB_PASSWORD = 'MatKhauPostgreSQLCuaBan'
$env:APP_BOOTSTRAP_ADMIN_PASSWORD = 'MatKhauQuanTriItNhat10KyTu'
.\run.ps1
```

Mở `http://localhost:8080` và đăng nhập bằng tài khoản `admin` cùng mật khẩu vừa cấu hình. Nếu không đặt `APP_BOOTSTRAP_ADMIN_PASSWORD`, ứng dụng tạo mật khẩu khởi tạo ngẫu nhiên và ghi một lần vào log khởi động. Chỉ tài khoản đầu tiên được khởi tạo tự động; sau đó quản trị viên tạo tài khoản cho các vai trò khác.

Đổi cổng:

```powershell
.\run.ps1 -Port 8081
```

Hoặc biên dịch ứng dụng:

```powershell
.\mvnw.cmd -DskipTests package
```

## Cấu trúc mã nguồn

```text
src/main/java/com/courseregistration/
├── config/       # Cấu hình web, bảo mật và tài khoản quản trị đầu tiên
├── controller/  # REST API theo nhóm chức năng
├── dto/         # Dữ liệu request/response
├── entity/      # Mô hình dữ liệu và trạng thái nghiệp vụ
├── repository/  # Truy vấn cơ sở dữ liệu
├── security/    # Nạp danh tính, quyền truy cập và xác thực phiên
└── service/     # Quy tắc nghiệp vụ, học vụ, tài khoản, báo cáo, audit

src/main/resources/static/
├── index.html   # Cổng sinh viên
├── workspace.html
├── login.html
├── forgot-password.html
├── reset-password.html
├── change-password.html
└── assets/
    ├── css/     # CSS theo từng khu vực
    └── js/
        ├── core/      # Client gọi API chung
        └── features/
            ├── auth/       # Đăng nhập, đổi mật khẩu, OTP
            ├── student/    # Màn hình sinh viên
            └── workspace/  # Điều hướng và cấu hình màn hình theo chức năng
```

## Nhóm chức năng đã có

- Tài khoản và phiên đăng nhập; đổi mật khẩu và đặt lại qua OTP email 6 chữ số, hết hạn sau 10 phút, tối đa 5 lần nhập sai.
- Sinh viên tìm/lọc lớp, xem chi tiết, đăng ký và hủy trong thời hạn cho phép, vào danh sách chờ, xem lịch sử, thời khóa biểu và khung chương trình.
- Giảng viên chọn học kỳ, xem lịch được phân công, tra cứu/lọc/sắp xếp danh sách sinh viên và xuất CSV.
- Sinh viên chọn học kỳ để xem hoặc xuất thời khóa biểu; có thể tra cứu chương trình đào tạo khác và xem chi tiết môn học/đề cương nếu đã khai báo liên kết.
- Ban Đào tạo quản lý học kỳ, đợt đăng ký, môn, lớp, chương trình và tiên quyết; lọc báo cáo theo học kỳ/môn/lớp, xem số liệu tổng hợp và xuất CSV.
- Quản trị viên quản lý tài khoản, cấu hình quyền theo vai trò, lọc/xem/xuất nhật ký và xem tổng quan.
- Chatbot dùng dịch vụ AI tương thích OpenAI khi được cấu hình khóa API; gửi ngữ cảnh học vụ và lịch sử hội thoại gần nhất. Không có khóa API thì dùng bộ luật tra cứu và báo rõ chế độ phản hồi.

## Cấu hình môi trường

### Bộ dữ liệu học vụ mẫu đầy đủ

Đã nhập bộ CSV/Excel gồm 90 sinh viên, 21 giảng viên, danh mục khoa/ngành/lớp,
chương trình, kết quả học tập, đăng ký và lịch học kỳ vào database PostgreSQL riêng (`coursebot_academic_demo`).
Chạy `.\run-academic-demo.ps1` để tự tạo database PostgreSQL `coursebot_academic_demo`, nạp dữ liệu mẫu và mở tại `http://localhost:8084/login.html`.
Xem [hướng dẫn và tài khoản dữ liệu học vụ](docs/academic-data-import.md).
Giờ tiết đang dùng bảng mẫu được người dùng cung cấp, giữ trạng thái chờ xác nhận.
Các database thời khóa biểu 20251/20261 và bản cổng 8082 được giữ độc lập.

### Database thời khóa biểu từ Excel

Đã có công cụ `tools/import_timetable.py` để tạo file nguồn chuẩn hóa từ file
thời khóa biểu của trường, sau đó `TimetableImportService` nạp vào PostgreSQL. Cấu trúc lưu nhiều buổi học, phòng và tuần học cho mỗi lớp;
giữ dữ liệu gốc và ghi nhận các dòng cần rà soát. Xem [hướng dẫn nhập thời khóa biểu](docs/timetable-import.md).
Backend đã hỗ trợ nhiều buổi học và kiểm tra trùng lịch theo tuần. Chạy
`.\run-timetable.ps1 -PreviewAccounts` để nạp vào database PostgreSQL `coursebot_timetable_preview` và xem tại `http://localhost:8082`
bằng các tài khoản preview ở đầu tài liệu. Khi chạy `.\run-timetable.ps1` không có
tham số preview, ứng dụng dùng database PostgreSQL riêng `coursebot_timetable`
và khởi tạo quản trị viên theo `APP_BOOTSTRAP_ADMIN_PASSWORD`.
Học kỳ 20261 được mở đăng ký liên tục ở lần nhập đầu tiên; ngày học chính thức
giữ trống. Ban Đào tạo có thể bật/tắt chế độ này ở mục Học kỳ và khai báo Đợt đăng ký
theo ngày, giờ khi có thông tin. Những lần khởi động sau giữ nguyên các chỉnh sửa.

Thiết lập các biến môi trường trước khi chạy nếu cần:

| Biến | Mục đích |
| --- | --- |
| `DB_HOST`, `DB_PORT` | Máy chủ và cổng PostgreSQL, mặc định `localhost` và `5432` |
| `DB_NAME` | Tên database PostgreSQL, mặc định `coursebot` |
| `DB_USERNAME`, `DB_PASSWORD` | Tài khoản và mật khẩu PostgreSQL, mặc định user `postgres` |
| `SPRING_DATASOURCE_URL` | Ghi đè toàn bộ JDBC URL PostgreSQL nếu cần |
| `APP_AUTO_CREATE_DB` | Tự động tạo database trên PostgreSQL khi chưa có, mặc định `true` |
| `APP_BOOTSTRAP_ADMIN_USERNAME` | Tên tài khoản quản trị đầu tiên, mặc định `admin` |
| `APP_BOOTSTRAP_ADMIN_PASSWORD` | Mật khẩu khởi tạo; tối thiểu 10 ký tự |
| `APP_DROP_WINDOW_DAYS` | Số ngày đầu học kỳ được tự hủy đăng ký, mặc định `7` |
| `SMTP_HOST`, `SMTP_PORT` | Máy chủ email để gửi mã OTP đặt lại mật khẩu |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | Thông tin SMTP nếu máy chủ yêu cầu xác thực |
| `SMTP_FROM` | Địa chỉ gửi email |
| `AI_API_KEY` | Khóa dịch vụ AI tương thích OpenAI; bỏ trống để dùng bộ luật dự phòng |
| `AI_API_URL` | URL chat completions, mặc định OpenAI-compatible `/v1/chat/completions` |
| `AI_MODEL` | Tên model gửi cho dịch vụ AI, mặc định `gpt-4o-mini` |
| `APP_PUBLIC_URL` | URL công khai của hệ thống dùng trong email OTP |
| `SESSION_COOKIE_SECURE` | Đặt `true` khi chạy sau HTTPS |
| `PORT` | Cổng HTTP, mặc định `8080` |
| `TIMETABLE_SOURCE_URL` | JDBC URL database H2 nguồn đã chuẩn hóa; để trống thì không nhập |
| `TIMETABLE_REGISTRATION_ALWAYS_OPEN` | Mở liên tục cho học kỳ mới trong lần nhập đầu tiên; mặc định `false` |

Nếu chưa cấu hình SMTP, chức năng yêu cầu đặt lại mật khẩu sẽ báo chưa cấu hình email. Đặt `APP_PUBLIC_URL` chính xác khi chạy ở máy chủ khác localhost. Chỉ chia sẻ khóa AI qua biến môi trường, không đưa khóa vào mã nguồn.

## Những điểm cần cấu hình để vận hành với dữ liệu thật

Ứng dụng không tạo tài khoản sinh viên/giảng viên hay dữ liệu học vụ mẫu. Sau khi đăng nhập tài khoản quản trị đầu tiên, tạo tài khoản và hồ sơ người dùng, sau đó Ban Đào tạo khai báo học kỳ, môn học, lớp, chương trình đào tạo và đợt đăng ký. Nếu thư mục dữ liệu đang có cơ sở dữ liệu từ lần chạy trước, ứng dụng giữ các bản ghi đó và chỉ bổ sung các trường mới cần thiết.

Ứng dụng bắt đầu với một ma trận quyền mặc định theo bốn vai trò; Quản trị viên có thể chỉnh ma trận tại mục “Phân quyền”. Quyền thiết yếu quản lý tài khoản và phân quyền luôn được giữ cho vai trò Quản trị viên. Dịch vụ AI là tùy chọn cấu hình; khi chưa có khóa, chatbot vẫn tra cứu dữ liệu nghiệp vụ bằng bộ luật.

Giới hạn đăng ký mặc định là 20 tín chỉ mỗi học kỳ và có thể chỉnh bằng `app.enrollment.max-credits`. Thời hạn tự hủy mặc định là 7 ngày, có thể chỉnh bằng `APP_DROP_WINDOW_DAYS`; sau thời hạn này hệ thống từ chối thao tác và hướng dẫn sinh viên liên hệ Ban Đào tạo.

## Một số API chính

- Xác thực: `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/change-password`, `/api/auth/forgot-password`, `/api/auth/reset-password`
- Sinh viên: `/api/dashboard`, `/api/courses`, `/api/enroll`, `/api/drop`, `/api/enrollments/history`, `/api/student/curricula`, `/api/student/curriculum`, `/api/student/schedule`
- Workspace: `/api/workspace/lecturer`, `/api/workspace/training-office`, `/api/workspace/admin`
- Quản trị học vụ: `/api/training/**`, `/api/admin/accounts`, `/api/admin/permissions`, `/api/admin/audit-logs`, `/api/reports`

Spring Security bảo vệ API theo vai trò; các API nghiệp vụ yêu cầu đăng nhập. Hệ thống sử dụng PostgreSQL (`jdbc:postgresql://localhost:5432/coursebot`, mặc định user `postgres`) và tự động tạo các database riêng biệt cho từng chế độ chạy (`coursebot`, `coursebot_preview`, `coursebot_academic_demo`, `coursebot_timetable`, `coursebot_timetable_preview`).
