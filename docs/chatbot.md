# Trợ lý EduPortal

## Chức năng đã triển khai

- Tra cứu chỉ theo sinh viên đang đăng nhập: hồ sơ học vụ, tín chỉ, lịch từng buổi/tuần,
  lịch sử Đã đăng ký/Chờ xác nhận/Đã hủy, kết quả từng lần học và các môn còn thiếu.
- Tra cứu mã hoặc tên môn trong toàn danh mục, kể cả môn chưa mở lớp; không giới hạn ở 50 môn đầu.
- Hỏi tiếp về môn vừa nhắc trong tối đa 12 tin nhắn gần nhất.
- Tra cứu hạn đăng ký chính xác ngày giờ, trạng thái đóng/mở, ngày học kỳ và hạn tự hủy.
- Lọc lịch theo thứ/tuần; hỏi hôm nay/ngày mai dùng ngày bắt đầu tuần 1. Thiếu ngày này sẽ báo chưa đủ dữ liệu.
- Giải thích điều kiện Tiên quyết/Học trước/Song hành bằng kết quả và đăng ký của chính sinh viên.
- Gợi ý tối đa 3 lớp, ưu tiên khung chương trình đúng ngành/khóa; loại môn đã đạt,
  đã đăng ký/chờ xác nhận, lớp đầy/đóng, lịch hoặc sĩ số chưa rõ, điều kiện chưa rõ,
  lớp kèm chưa có quy tắc xác nhận. Kiểm tra tổng tín chỉ và mọi cặp buổi theo tuần,
  kể cả trùng giữa các lớp được gợi ý. Không tự đăng ký/hủy.
- Câu trả lời kèm nhãn dữ liệu tham chiếu; hiển thị rõ chế độ tại hệ thống hay có AI trực tuyến.
- Giới hạn 20 câu/phút/phiên; 1.000 ký tự/câu, 12 tin lịch sử, kiểm tra vai trò tin nhắn.
- Giao diện có câu hỏi gợi ý, trạng thái đang trả lời, báo lỗi và xóa hội thoại tại trình duyệt.

Không có tài liệu quy chế chính thức nên các hạn mức project (20 tín chỉ, 7 ngày tự hủy)
được mô tả là cấu hình thử nghiệm, không tự khẳng định là quy định trường.
Không bịa học phí, học bổng, điều kiện tốt nghiệp, GPA hay số điện thoại Phòng Đào tạo.
Bảng giờ mẫu giữ nguyên nhãn chờ xác nhận. Chờ xác nhận không được đổi thành danh sách chờ.
Học trước/Song hành được đối chiếu khi tư vấn; backend đăng ký hiện chỉ áp dụng kiểm tra Tiên quyết,
và trợ lý nói rõ sự khác biệt này. Bộ dữ liệu mẫu cũng chưa phải hồ sơ thật của trường.

## Chạy ngay, không cần khóa API

```powershell
.\run-academic-demo.ps1
```

Mở `http://127.0.0.1:8084/#assistant`, đăng nhập bằng email sinh viên mẫu
`24it001@sv.demo.edu.vn`, mật khẩu `AcademicDemo2026!`.
Đây là trợ lý tra cứu/tư vấn theo quy tắc và dữ liệu; không giả lập rằng đã có mô hình AI trực tuyến.

Hội thoại chỉ giữ trong bộ nhớ của tab, không được lưu vào bảng học vụ. Xóa hội thoại hoặc tải lại
sẽ mất ngữ cảnh cũ. Mỗi câu hỏi đều đọc lại dữ liệu hiện tại. Không có API chatbot nào ghi đăng ký/điểm.

## Kết nối model tùy chọn

Đã có bộ gọi endpoint chat-completions tương thích với cấu trúc request/response hiện tại.
Đặt biến môi trường trước khi khởi động (không lưu khóa trong source):

```powershell
$env:AI_API_URL = 'https://YOUR-PROVIDER.example/v1/chat/completions'
$env:AI_MODEL = 'YOUR-MODEL'
$env:AI_API_KEY = 'YOUR-KEY'
$env:AI_TIMEOUT_SECONDS = '12'
.\run-academic-demo.ps1
```

Các giá trị YOUR-* là chỗ điền, không phải dịch vụ đã cấu hình. Không cần tạo tài khoản hoặc
mua dịch vụ để dùng chế độ tại hệ thống. Chưa có khóa thì không thực hiện kết nối ra ngoài.
Nếu tự host endpoint yêu cầu một token cục bộ, cấu hình token đó tương tự.

Khi bật khóa, chỉ câu hỏi và câu trả lời học vụ đã tra cứu được gửi tới nhà cung cấp để diễn đạt thêm;
không gửi toàn database, danh sách sinh viên, email/điện thoại hay toàn lịch sử hội thoại.
Vì câu trả lời có thể chứa điểm và lịch học cá nhân, chỉ cấu hình dịch vụ được phép dùng với dữ liệu đó.
Câu trả lời gốc luôn được giữ, phần model được gắn “Diễn giải AI (tham khảo)”. Model vẫn có thể diễn đạt sai;
dữ liệu gốc có nguồn được hiển thị để đối chiếu. Khi endpoint lỗi/rỗng/hết thời gian, trả kết quả tra cứu tại hệ thống.
Kết nối có giới hạn 3 giây, chờ kết quả mặc định 12 giây (tối đa 30).
Không có khóa thật trong phiên triển khai này; đường kết nối được kiểm tra bằng endpoint giả lập cục bộ,
không tuyên bố đã xác minh dịch vụ AI thương mại.

## API và kiểm thử

- `GET /api/chat/status`: thông tin chế độ, không trả khóa API.
- `POST /api/chat`: `{message, history:[{role,content}]}`; trả `{reply,aiPowered,mode,sources,suggestions}`.
- Các endpoint yêu cầu đăng nhập và quyền STUDENT_ACADEMIC; dữ liệu cá nhân luôn lấy từ phiên đăng nhập.

```powershell
.\mvnw.cmd test
.\tools\check_chatbot.ps1
```

Kiểm thử gồm: buổi thứ hai bị trùng, tuần khác nhau không trùng, các gợi ý trùng nhau,
tổng tín chỉ, điều kiện Học trước/Song hành, kết quả học lại, lớp đầy/chờ xác nhận,
môn ngoài 50 dòng đầu, hội thoại dài, từ chối role system, giới hạn tần suất,
endpoint AI trả đúng/sai/lỗi và giữ câu trả lời có nguồn.

Ví dụ câu hỏi thử:

1. Tôi đã đăng ký bao nhiêu tín chỉ?
2. INF202 có bao nhiêu tín chỉ?
3. Còn điều kiện của môn đó?
4. Lịch học thứ 3 tuần 8.
5. Ngày mai tôi học gì?
6. Gợi ý môn học phù hợp.
7. Tôi còn thiếu môn nào?
8. Xem kết quả học tập.
9. Tôi có môn nào chưa đạt cần học lại?
10. Khi nào hết hạn đăng ký?
11. Tôi muốn hủy môn.
12. Song hành khác tiên quyết như thế nào?
13. Đăng ký chờ xác nhận của tôi.
14. Lớp đầy thì làm thế nào?
15. Học phí trường bao nhiêu? (phải báo thiếu dữ liệu).
