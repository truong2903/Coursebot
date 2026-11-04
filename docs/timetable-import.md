# Database thời khóa biểu 20261

Nguồn: `TKB20261-FULL.xlsx`, tiêu đề ghi cập nhật ngày 11/09/2026.
Database H2 riêng: `data/imports/tkb20261/timetable-20261.mv.db`.
Bản SQL để tái tạo: `data/imports/tkb20261/timetable-20261.sql`.
Đây là database nguồn đã chuẩn hóa. Backend có bộ nhập sang các bảng nghiệp vụ,
chạy một lần cho mỗi SHA-256 nguồn và giữ nguyên chỉnh sửa khi khởi động lại.

## Chạy ứng dụng với dữ liệu thời khóa biểu

```powershell
$env:DB_PASSWORD = 'MatKhauPostgreSQLCuaBan'
.\run-timetable.ps1 -PreviewAccounts
```

Mở `http://localhost:8082/login.html`, dùng các tài khoản preview trong README.
Bản này dùng database PostgreSQL `coursebot_timetable_preview`, được lưu qua các lần chạy.
Chạy không có `-PreviewAccounts` để dùng database PostgreSQL `coursebot_timetable`
với tài khoản quản trị khởi tạo riêng. Hai chế độ đều đọc cùng database nguồn chuẩn hóa,
và không thay đổi database PostgreSQL của những bản khác (`coursebot`, `coursebot_preview`, `coursebot_academic_demo`).

Học kỳ 20261 được mở đăng ký liên tục theo yêu cầu hiện tại. Các ngày chưa biết
vẫn để NULL. Trong **Học kỳ**, tùy chọn **Mở đăng ký liên tục (tạm thời)** có thể bật/tắt;
tắt khi chưa có khoảng thời gian đăng ký sẽ đóng cổng. Học kỳ hoàn tất hoặc lưu trữ
luôn đóng đăng ký. Khai báo/cập nhật **Đợt đăng ký** với ngày và giờ sẽ tự tắt chế độ
mở liên tục để dùng thời hạn chính thức.

Khi chưa có ngày bắt đầu học kỳ và đang mở liên tục, sinh viên có thể hủy lớp.
Sau khi khai báo ngày bắt đầu, hệ thống áp dụng giới hạn hủy theo số ngày cấu hình.

## Dữ liệu đã nhập

| Bảng | Nội dung | Số bản ghi |
| --- | --- | ---: |
| `timetable_semesters` | Mã học kỳ; các ngày chưa được cung cấp để NULL | 1 |
| `timetable_departments` | Mã trường/viện/khoa theo nguồn | 14 |
| `timetable_courses` | Mã, tên Việt/Anh, khối lượng và số tín chỉ | 2.384 |
| `timetable_sections` | Mã lớp, môn, loại lớp, trạng thái, sĩ số và ghi chú | 11.011 |
| `timetable_section_links` | Quan hệ mã lớp kèm theo nguồn, kể cả tự tham chiếu | Theo nguồn |
| `timetable_rooms` | Mã phòng theo nguồn | 511 |
| `timetable_meetings` | Từng dòng thời khóa biểu, kể cả dòng chưa xếp lịch | 14.733 |
| `timetable_meeting_weeks` | Các tuần được tách từ chuỗi tuần rõ nghĩa | 113.937 |
| `timetable_source_rows` | Toàn bộ ô của từng dòng không rỗng, cả hai sheet | 14.736 |
| `timetable_imports` | Tên nguồn, SHA-256, ngày cập nhật, thời điểm nhập | 1 |
| `timetable_import_issues` | Các dữ liệu cần rà soát, có liên kết tới dòng gốc | Theo kiểm tra |

Một lớp có nhiều buổi học. Buổi học có phòng riêng và tập hợp tuần riêng.
Thứ trong nguồn được chuyển sang ISO: thứ 2 → 1, …, chủ nhật (8) → 7.
Ví dụ `2-9,11-18` được tách thành 16 tuần, không lấy cả tuần 10.
`Khối_lượng` được giữ nguyên; số tín chỉ là số trước dấu ngoặc, bao gồm giá trị 0.

Số `SLĐK` chỉ là số liệu tại thời điểm xuất file. Nó không tạo ra tài khoản sinh viên,
bản ghi đăng ký hay lịch sử đăng ký giả. Trường thiếu giữ NULL. Mã đơn vị được giữ
nguyên vì file không cung cấp tên đầy đủ của các mã đó. Trạng thái trường được giữ
nguyên; chưa tự quy đổi “Điều chỉnh ĐK” thành đang mở đăng ký.

## Những dữ liệu cần rà soát

| Mã kiểm tra | Kết quả |
| --- | --- |
| `ENROLLED_EXCEEDS_CAPACITY` | 2.520 lớp có SLĐK lớn hơn SL_Max; giữ cả hai số |
| `UNKNOWN_ENROLLED` | 187 lớp chưa có SLĐK |
| `ZERO_CREDITS` | 35 môn ghi 0 tín chỉ; giữ nguyên |
| `MISSING_SCHEDULE` | 729 dòng thiếu lịch có thể sử dụng, gồm 4 dòng giờ không hợp lệ |
| `MISSING_ROOM` | 1.019 dòng chưa có phòng |
| `INVALID_TIME` | 4 dòng có khoảng giờ không hợp lệ; giữ `time_raw`, giờ chuẩn hóa để NULL |
| `AMBIGUOUS_WEEKS` | 14 dòng ghi tuần dạng `11.13`, `15.17`, `16.18`; giữ `weeks_raw`, chưa tách tuần |

Lớp bị hủy vẫn được lưu với trạng thái gốc để đối chiếu. File có 355 lớp bị hủy.
Sheet2 chứa một công thức mẫu dạng văn bản, không được xem là thời khóa biểu.
Nội dung đó được lưu trong bảng nguồn để truy vết.

Tra cứu các dòng bất thường:

```sql
SELECT i.issue_code, r.sheet_name, r.row_number, i.details
FROM timetable_import_issues i
JOIN timetable_source_rows r ON r.id = i.source_row_id
ORDER BY i.issue_code, r.row_number;
```

## Mở database

Sử dụng H2 2.3.232 (cùng phiên bản driver hiện tại của project).
JDBC URL, tính từ thư mục project:

```text
jdbc:h2:file:./data/imports/tkb20261/timetable-20261
```

User: `sa`; mật khẩu trống, theo cấu hình phát triển hiện tại.
Database nguồn này có schema riêng. Không đổi datasource của ứng dụng sang đây.
`TimetableImportService` đọc nguồn rồi nhập vào `courses`, `semesters`,
`course_sections`, `section_meetings` của database ứng dụng. Nguồn luôn được mở chỉ đọc.

## Chạy lại công cụ nhập

Python cần `openpyxl`, máy cần Java và H2 driver trong Maven cache. Từ thư mục project:

```powershell
python tools/import_timetable.py 'E:\CODE\PTvTKHDT\TKB20261-FULL.xlsx' --output data/imports/tkb20261-new
```

Công cụ từ chối ghi đè database đã tồn tại. Có thể chỉ định driver bằng `--h2-jar`.
Database, SQL, thống kê `summary.json` và kết quả đối chiếu `verification.txt` được tạo
trong thư mục đầu ra. `data/` đã được project bỏ qua trong Git.

## Quy tắc khi sử dụng trong ứng dụng

- Lớp cho phép chưa phân công giảng viên; API trả “Chưa phân công”.
- Các API chi tiết lớp, danh sách lớp và thời khóa biểu trả thêm `meetings`.
  Mỗi buổi có `dayOfWeek` (ISO 1–7), `startsAt`, `endsAt`, `room`, `weeksExpression`,
  `weeks`, `valid`, `sourceRow`, `timeRaw`. Các trường `schedule`, `room` cũ vẫn có bản tóm tắt.
- API tạo/sửa lớp nhận danh sách `meetings`. Lịch dạng chuỗi một buổi vẫn được chấp nhận
  để tương thích. Màn hình quản lý lớp có thể thêm/xóa từng buổi và sửa tuần học.
- Trùng lịch xét mọi cặp buổi cùng thứ, giao nhau về giờ và có tuần học chung.
  Hai buổi liền kề hoặc học các tuần khác nhau không trùng. Phòng và giảng viên
  cũng được kiểm tra theo các buổi và tuần khi tạo/sửa lớp.
- Trạng thái “Huỷ lớp” được nhập thành `CANCELLED`; “Đăng ký”, “Điều chỉnh ĐK” thành
  `OPEN`; các trạng thái khác thành `CLOSED`. Mở học kỳ không tự mở các lớp đã đóng/hủy.
- Sĩ số hiển thị và giới hạn chỗ bằng `importedEnrolled` từ trường cộng lượt đăng ký
  đang hiệu lực tại ứng dụng. Hủy lớp chỉ trừ lượt đăng ký cục bộ. Không tạo sinh viên giả.
- Những lớp thiếu lịch rõ nghĩa hoặc chưa rõ sĩ số được gắn `scheduleReviewRequired`;
  backend từ chối đăng ký đến khi Ban Đào tạo xác nhận lịch và sĩ số. Lớp chưa có phòng
  vẫn thể hiện “Chưa có phòng”. Các giá trị gốc còn trong database nguồn.
- Đọc danh sách dùng truy vấn tổng hợp sĩ số và tải theo lô để phục vụ hơn 11.000 lớp.
  Màn hình sinh viên hiển thị 50 lớp mỗi trang và lọc thứ theo tất cả buổi học.
- Nhập dữ liệu có giao dịch: gặp mã lớp xung đột hoặc môn cùng mã khác tên/tín chỉ sẽ
  hủy toàn bộ lần nhập. Không ghi đè dữ liệu nghiệp vụ sẵn có.

Chạy kiểm thử Java bằng `.\mvnw.cmd test`. Script `tools/check_timetable_backend.ps1`
tạo dữ liệu kiểm tra qua API và chỉ dành cho một máy chủ thử nghiệm mới dùng database
trong bộ nhớ ở cổng 8083, với nguồn thời khóa biểu và tài khoản preview; không chạy
script này trên database đang sử dụng.

Nguồn này không có khung chương trình, môn tiên quyết, danh sách sinh viên hay
phân công giảng viên. Những dữ liệu đó cần được cung cấp riêng.
