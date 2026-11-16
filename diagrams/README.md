# Thư mục Sơ đồ Hệ thống (`diagrams`)

Thư mục này dùng để lưu trữ toàn bộ các sơ đồ phân tích và thiết kế của dự án.

## Cấu trúc thư mục

| Thư mục | Loại sơ đồ | Mục đích |
| :--- | :--- | :--- |
| `use-case/` | Use Case Diagram | Mô tả tác nhân (actor) và các ca sử dụng của hệ thống |
| `activity/` | Activity Diagram | Mô tả luồng nghiệp vụ và quy trình xử lý |
| `sequence/` | Sequence Diagram | Mô tả tương tác tuần tự giữa các đối tượng/thành phần theo thời gian |
| `class/` | Class Diagram | Mô tả các lớp, thuộc tính, phương thức và quan hệ hướng đối tượng |
| `state/` | State Machine Diagram | Mô tả vòng đời và các trạng thái chuyển đổi của đối tượng |
| `erd/` | Entity Relationship Diagram | Mô tả mô hình thực thể liên kết và cấu trúc cơ sở dữ liệu |
| `component/` | Component Diagram | Mô tả cấu trúc các module/thành phần phần mềm và sự phụ thuộc |
| `deployment/` | Deployment Diagram | Mô tả kiến trúc triển khai phần cứng/môi trường chạy hệ thống |

## Quy ước đặt tên gợi ý

- Sử dụng chữ thường và dấu gạch ngang (`kebab-case`), ví dụ:
  - `use-case/uc-tong-quan-he-thong.puml`
  - `sequence/seq-dang-ky-hoc-phan.mmd`
  - `activity/act-dang-nhap.drawio`
- Hỗ trợ lưu cả file nguồn (`.puml`, `.mmd`, `.drawio`) và file xuất ảnh (`.png`, `.svg`) trong cùng thư mục tương ứng.
