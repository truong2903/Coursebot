# Dữ liệu học vụ mẫu

Bộ CSV `du_lieu_mau_csv` và workbook `du_lieu_mau_quan_ly_dao_tao.xlsx` do người dùng cung cấp
được đối chiếu theo từng ô nghiệp vụ. Chuẩn hóa biểu diễn ngày và số thập phân khi so sánh;
giữ số điện thoại, mã ngành và mã người dùng dưới dạng chuỗi.
Nguồn xác định đây là dữ liệu giả phục vụ thử nghiệm.

## Database và chạy ứng dụng

- Nguồn staging chuẩn hóa: `data/imports/academic-demo/academic-demo.mv.db`.
- SQL tái tạo nguồn: `data/imports/academic-demo/academic-demo.sql`.
- Database ứng dụng PostgreSQL: `coursebot_academic_demo` (`jdbc:postgresql://localhost:5432/coursebot_academic_demo`).
- Không đồng nhất `2026-2027-1` với `20261` hoặc `20251`; không trộn các mã môn khác nhau.
- Các database thời khóa biểu và bản chạy cổng 8082 dùng database PostgreSQL riêng biệt.

```powershell
$env:DB_PASSWORD = 'MatKhauPostgreSQLCuaBan'
.\run-academic-demo.ps1
```

Mở `http://localhost:8084/login.html`. Mật khẩu khởi tạo của bản dữ liệu giả này là
`AcademicDemo2026!`. Sinh viên và giảng viên đăng nhập bằng **email trong CSV**.
Ví dụ sinh viên `24it001@sv.demo.edu.vn`, giảng viên `tuannm@demo.edu.vn`.
Quản trị: `admin`; Ban Đào tạo: `academic_training`.
Có 113 tài khoản: 90 sinh viên, 21 giảng viên và 2 tài khoản quản lý.
Khởi động lại không đặt lại mật khẩu và không ghi đè dữ liệu đã chỉnh sửa.

Kết nối PostgreSQL mặc định (`DB_HOST=localhost`, `DB_PORT=5432`, `DB_USERNAME=postgres`):

```text
jdbc:postgresql://localhost:5432/coursebot_academic_demo
```

## Ánh xạ dữ liệu

| Nguồn | Bảng ứng dụng | Số dòng |
| --- | --- | ---: |
| Khoa | departments | 6 |
| Ngành | academic_programs | 6 |
| Lớp hành chính | administrative_classes | 18 |
| Sinh viên | students | 90 |
| Giảng viên | lecturers | 21 |
| Học phần | courses | 73 |
| Lớp học phần | course_sections, section_meetings | 52 lớp, 52 buổi |
| Phân công | course_sections.lecturer_id | 52 |
| Chương trình | curricula | 18 |
| Chi tiết chương trình | curriculum_courses | 462 |
| Điều kiện môn học | course_conditions | 53 |
| Kết quả học tập | academic_results | 894 |
| Đăng ký | enrollments | 412 |
| Lịch học kỳ | semesters, registration_periods | 6 |
| Tiết học mẫu | teaching_periods | 12 |

Sinh viên liên kết lớp hành chính → ngành → khoa; lưu điện thoại, email, khóa, trạng thái học tập.
Giảng viên lưu khoa, bộ môn, học vị, học hàm, điện thoại, email.
Các trường cũ `program` và `department` được giữ để tương thích API hiện có.
Các trường hồ sơ mới đã được lưu; các form quản lý hiện tại chưa có đầy đủ ô chỉnh sửa chúng.

Kết quả học tập giữ cả lần chưa đạt và lần học lại đạt, điểm số và điểm chữ có thể NULL theo nguồn.
`student_completed_courses` là tập mã môn có ít nhất một kết quả Đạt, không nhân đôi khi học lại.
46 điều kiện Tiên quyết được đưa vào bảng kiểm tra tiên quyết hiện tại.
6 điều kiện Học trước và 1 điều kiện Song hành được lưu đúng loại trong `course_conditions`;
backend đăng ký hiện chưa kiểm tra riêng hai loại này. Không chuyển chúng thành điều kiện phải đạt.

Đăng ký Đã đăng ký → ENROLLED (378), Chờ xác nhận → PENDING (22), Đã hủy → CANCELLED (12).
PENDING không phải danh sách chờ lớp đầy. Sĩ số chỉ đếm ENROLLED; `imported_enrolled=0`
vì đã có danh tính sinh viên và bản ghi đăng ký cụ thể, tránh đếm hai lần.
Nguồn chỉ có ngày đăng ký: lưu midnight làm biểu diễn kỹ thuật kèm `enrollment_date_only=true`;
lịch sử giao diện hiển thị ngày, không thể hiện đó là giờ đăng ký thật.

## Bảng tiết và lịch học kỳ

Tại lúc nhập, workbook trên máy có 14 sheet dữ liệu và chưa có sheet `15_tiet_hoc`.
Bảng 12 tiết do người dùng cung cấp trong hội thoại được lưu tại `config/academic-demo-periods.csv`.
Mỗi tiết giữ trạng thái **Mẫu – chờ nhà trường xác nhận**.
Giờ đầu buổi lấy từ tiết bắt đầu, giờ cuối lấy từ tiết `bắt đầu + số tiết - 1`;
giữ `start_period`, `period_count`, `time_source_status` để truy vết.
Khoảng nghỉ không bị coi là các tiết học thêm. Chuỗi lịch hiển thị rõ giờ là mẫu.
Các giờ này chỉ được dùng tạm trong bộ dữ liệu mẫu này.
Khi nhận giờ thật cần cập nhật bảng tiết và đồng bộ giờ các buổi trong cùng giao dịch;
sửa CSV nguồn đơn thuần không tự thay đổi database ứng dụng đã nhập.

Học kỳ giữ tên, năm học, số học kỳ, ngày bắt đầu/kết thúc, ngày bắt đầu tuần 1 và số tuần.
Thời gian đăng ký giữ chính xác ngày giờ từ nguồn, không bật chế độ mở liên tục.
Ở ngày 26/10/2026, học kỳ 2026-2027-1 đang học nhưng đã hết đợt đăng ký trong nguồn.
Đây là cấu hình riêng, không thay chế độ mở liên tục của kỳ 20261.

## Nhập lại và kiểm tra

```powershell
python tools/import_academic_data.py 'E:\CODE\PTvTKHDT\du_lieu_mau_csv' --workbook 'E:\CODE\PTvTKHDT\du_lieu_mau_quan_ly_dao_tao.xlsx' --output data/imports/academic-demo-new
```

Mỗi bảng nguồn có khóa chính và khóa ngoại, kiểm tra miền giá trị. Các ô gốc CSV và workbook
được giữ ở `source_raw_rows`. Công cụ từ chối ghi đè database đã tồn tại.
Nếu có `15_tiet_hoc.csv` trong thư mục nguồn, công cụ ưu tiên dùng file đó;
nếu workbook có sheet 15 sẽ đối chiếu với CSV. Nếu chưa có, dùng `--periods` (mặc định file cấu hình trên).

Backend nhận `ACADEMIC_SOURCE_URL` và `ACADEMIC_INITIAL_PASSWORD` qua launcher.
SHA-256 của toàn bộ nguồn được lưu ở `academic_data_imports`; cùng nguồn được bỏ qua khi chạy lại.
Nguồn mới chỉ được nhập vào database nghiệp vụ chưa có dữ liệu; không ghi đè database khác.
Lần nhập dùng một giao dịch, có kiểm tra số lượng; lỗi hủy toàn bộ các bản ghi của lần nhập.

Đã kiểm tra toàn bộ 2.175 dòng nghiệp vụ của 15 nhóm dữ liệu sau khi nhập ứng dụng,
bao gồm từng trường liên hệ, điểm, phân công, ngày giờ, loại điều kiện và trạng thái.
Kết quả: `data/imports/academic-demo/application-verification.json`.
`summary.json` và `verification.txt` chứa kết quả kiểm tra nguồn.

```powershell
.\mvnw.cmd test
.\tools\check_academic_backend.ps1
```

Kiểm thử Java có trường hợp học lại, trạng thái PENDING, quy đổi tiết cuối,
khởi tạo mật khẩu BCrypt, nhập lại giữ chỉnh sửa và rollback khi xung đột muộn.
Script HTTP chỉ đọc dữ liệu nghiệp vụ ở cổng 8084; xác minh các vai trò, chương trình,
lịch sử, sĩ số báo cáo, phân công và đợt đăng ký.

Đối chiếu trực tiếp database PostgreSQL `coursebot_academic_demo` với CSV (không cần dừng ứng dụng ở cổng 8084):

```powershell
$env:DB_PASSWORD = 'MatKhauPostgreSQLCuaBan'
python tools/verify_academic_database.py 'E:\CODE\PTvTKHDT\du_lieu_mau_csv'
```
