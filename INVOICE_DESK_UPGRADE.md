# Đối chiếu Desktop và Web

Kiểm tra ngày 27/10/2026. Desktop: `L:/invoiceToExcel/src/main/java/invoice`.
Web thực tế: React `InvoiceDeskPage.jsx` nhúng `static/invoice-desk/index.html`.

| Chức năng | Trước nâng cấp | Hướng triển khai |
|---|---|---|
| Đọc PDF/ảnh, OCR | Có Engine dùng chung | Giữ nguyên provider và credentials |
| Import nhiều file | Có tuần tự, lỗi làm dừng batch | Hàng đợi riêng từng file, tiến trình Engine, hủy hợp tác |
| Chống trùng | Có SHA-256 theo tenant | Tái sử dụng |
| Sửa/duyệt | Có optimistic version và validation | Tự lưu, thao tác nhiều hóa đơn, lịch sử phiên bản |
| Xem gốc | Chỉ tải xuống | Xem từng trang, zoom, xoay và điều hướng |
| OCR cache | Tệp tạm bị xóa cuối import | Lưu phản hồi cache trong DB, đọc offline, lưu phiên bản trước thay đổi |
| Excel | Có bộ xuất Desktop, giữ decimal dài dạng chuỗi | Chỉ xuất đã duyệt, lọc tập được chọn |
| Phiên làm việc | Chưa có | DB, riêng user và tenant, danh sách tham chiếu dữ liệu đã lưu |
| Tài khoản hạn chế | Chưa có | ROLE_INVOICE_DESK và đổi mật khẩu ban đầu |
| Ngôn ngữ | Chủ yếu tiếng Anh | Giao diện tiếng Việt |

Không thay đổi certificate, Google credentials hoặc OAuth configuration. Không reset DB hay restart production.
