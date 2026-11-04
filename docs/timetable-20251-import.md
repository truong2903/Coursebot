# Database thời khóa biểu 20251

Nguồn: `E:\CODE\PTvTKHDT\TKB20251-FULL.xlsx`.
Tiêu đề nguồn: thời khóa biểu **dự kiến**, cập nhật ngày 05/08/2025.

Database H2 độc lập: `data/imports/tkb20251/timetable-20251.mv.db`.
Bản SQL: `data/imports/tkb20251/timetable-20251.sql`.
Thống kê: `summary.json`; kết quả đối chiếu: `verification.txt` trong cùng thư mục.

Database này chưa được nhập vào ứng dụng ở cổng 8082. Database kỳ 20261 và cấu hình chạy hiện tại được giữ nguyên.

## Dữ liệu

- 1 học kỳ, 13 đơn vị, 2.018 môn học, 8.302 lớp.
- 10.304 dòng buổi học, 416 phòng, 82.687 cặp buổi/tuần đã phân tích rõ nghĩa.
- 10.306 dòng nguồn không rỗng được lưu nguyên dữ liệu ô để đối chiếu.
- Cột `SL_Min` được lưu thành `timetable_sections.minimum_capacity`; `SL_Max` thành `capacity`.
- Ngày học và thời gian đăng ký chưa được cung cấp, giữ NULL.

## Dữ liệu cần xác nhận

5.477 lớp thiếu sĩ số đăng ký; 2 lớp vượt sức chứa; 27 môn có 0 tín chỉ.
561 dòng thiếu lịch đầy đủ, 808 dòng thiếu phòng, 1.145 dòng có chuỗi tuần chưa rõ nghĩa,
3 dòng có khoảng giờ không hợp lệ. Giữ thông tin gốc, không tự suy diễn.
Các vấn đề được lưu tại `timetable_import_issues`, liên kết với dòng Excel gốc.

## Mở database

Dùng H2 2.3.232 với JDBC URL tính từ thư mục project:

```text
jdbc:h2:file:./data/imports/tkb20251/timetable-20251
```

Tài khoản `sa`, mật khẩu trống theo cấu hình phát triển hiện tại.

## Tái tạo

```powershell
python tools/import_timetable.py 'E:\CODE\PTvTKHDT\TKB20251-FULL.xlsx' --output data/imports/tkb20251-new
```

Công cụ từ chối ghi đè database đã tồn tại. Công cụ hỗ trợ cả bố cục 20251
(có `SL_Min`) và 20261 (có `Chú ý`), ánh xạ theo tên cột.
Đã đối chiếu số lượng các bảng và toàn bộ 10.306 dòng nguồn sau khi lưu database;
không có dòng thời khóa biểu nào thiếu bản ghi buổi học tương ứng.
