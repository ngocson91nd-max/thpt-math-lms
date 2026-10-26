# 🎓 HỆ THỐNG LMS TOÁN THPT (HIGH SCHOOL MATH LMS)

Hệ thống Quản lý Học tập và Thi trực tuyến chuyên biệt dành cho môn **Toán cấp Trung học Phổ thông (Lớp 10, 11, 12)** tại Việt Nam. Xây dựng theo định hướng chương trình GDPT mới và cấu trúc đề thi Tốt nghiệp THPT 2025 của Bộ Giáo dục & Đào tạo.

---

## 🚀 ĐIỂM NỔI BẬT & CÔNG NGHỆ CỐT LÕI

- **Frontend / Backend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS.
- **Hiển thị Toán học KaTeX**: Render siêu tốc công thức toán học LaTeX inline (`$f(x)$`) và block (`$$\int_a^b f(x)\mathrm{d}x$$`), bảng biến thiên, vector, hệ tọa độ không gian $Oxyz$.
- **Cơ sở dữ liệu & Xác thực**: Supabase (PostgreSQL, Row Level Security - RLS, Supabase Auth, Storage).
- **Chấm điểm máy chủ (Server-side Auto-Grading)**: Bảo mật chống gian lận, không để lộ đáp án ở client.
- **Trợ lý AI (Math AI Assistant)**: Tích hợp qua API máy chủ (hỗ trợ Google Gemini / OpenAI), có chế độ dự phòng chuẩn sư phạm khi chưa cấu hình API key.
- **Kiểm thử tự động**: Bộ test Vitest bảo đảm thuật toán tính điểm và phân quyền đạt 100% pass.

---

## 📋 5 DẠNG CÂU HỎI TOÁN CHUẨN BỘ GD&ĐT 2025

1. **Phần I - Trắc nghiệm 4 lựa chọn (`single_choice`)**: 4 phương án $A, B, C, D$, một đáp án đúng duy nhất.
2. **Phần II - Trắc nghiệm Đúng / Sai 4 mệnh đề (`true_false`)**:
   - Gồm 4 ý $a, b, c, d$.
   - **Thang điểm quy đổi chuẩn Bộ GD&ĐT**:
     - Đúng 1 ý: 0.10 điểm (10% điểm câu).
     - Đúng 2 ý: 0.25 điểm (25% điểm câu).
     - Đúng 3 ý: 0.50 điểm (50% điểm câu).
     - Đúng 4 ý: 1.00 điểm (100% điểm câu).
3. **Phần III - Trả lời ngắn / Điền đáp số (`short_answer`)**:
   - Tự động chuẩn hóa dấu phẩy kiểu Việt Nam (`2,5`) sang dấu chấm (`2.5`).
   - Tự động nhận diện phân số tương đương (ví dụ `5/2` $\equiv$ `2.5`).
4. **Trắc nghiệm nhiều lựa chọn (`multiple_choice`)**: Hỗ trợ tính điểm tỷ lệ khi chọn đúng tập con không có ý sai.
5. **Tự luận trình bày (`essay`)**: Học sinh gõ bài giải hoặc đính kèm ảnh/file; giáo viên chấm điểm có AI phân tích và gợi ý nhận xét.

---

## 👥 PHÂN QUYỀN VAI TRÒ (RBAC)

Hệ thống có sẵn tính năng chuyển đổi nhanh giữa 3 vai trò ngay trên thanh điều hướng để trải nghiệm:

| Vai trò | Tài khoản mẫu | Quyền hạn |
| :--- | :--- | :--- |
| 🛡️ **Quản Trị Viên (Admin)** | `admin@thpt-math-lms.vn` | Quản lý toàn bộ hệ thống, tất cả lớp học, ngân hàng đề thi, tài khoản người dùng |
| 👨‍🏫 **Giáo Viên (Teacher)** | `teacher.toan@thpt-math-lms.vn` | Tạo lớp, cấp mã lớp, tạo câu hỏi với KaTeX, tạo đề thi, chấm bài tự luận |
| 👩‍🎓 **Học Sinh (Student)** | `student.mai@thpt-math-lms.vn` | Nhập mã tham gia lớp, xem bài giảng video, làm bài kiểm tra có bấm giờ, xem sổ điểm |

---

## 🛠️ HƯỚNG DẪN CÀI ĐẶT & CHẠY DỰ ÁN CỤC BỘ

### 1. Yêu cầu hệ thống
- **Node.js**: Phiên bản 18+ (khuyên dùng Node.js 22 hoặc 24 LTS)
- **Git**
- **Trình duyệt hiện đại** (Chrome, Edge, Firefox, Safari)

### 2. Cài đặt các gói phụ thuộc
```bash
# Clone hoặc mở thư mục dự án
cd D:\LMS

# Cài đặt toàn bộ dependencies
npm install
```

### 3. Cấu hình biến môi trường
Sao chép file `.env.example` thành `.env.local`:
```bash
cp .env.example .env.local
```
*(Nếu chưa có tài khoản Supabase hoặc AI API key, ứng dụng vẫn tự động hoạt động mượt mà ở chế độ offline/demo data).*

### 4. Chạy kiểm thử tự động (Unit Tests)
```bash
npm run test
```
*Kết quả: 21/21 tests pass về logic phân quyền và thuật toán chấm điểm.*

### 5. Khởi động môi trường phát triển (Development)
```bash
npm run dev
```
Mở trình duyệt truy cập: **`http://localhost:3000`**

### 6. Build bản phát hành (Production Build)
```bash
npm run build
npm run start
```

---

## 🗄️ CẤU TRÚC VÀ CÀI ĐẶT DATABASE SUPABASE

Toàn bộ mã nguồn SQL đã được cấu trúc trong thư mục `supabase/`:

1. **`supabase/migrations/20261026000001_initial_schema.sql`**:
   - 12 bảng PostgreSQL: `profiles`, `classes`, `class_members`, `courses`, `chapters`, `lessons`, `questions`, `exams`, `exam_questions`, `submissions`, `submission_answers`, `materials`.
   - Thiết lập khóa chính, khóa ngoại `ON DELETE CASCADE`.
   - **Row Level Security (RLS)** trên 100% các bảng bảo vệ dữ liệu học sinh và lớp học.

2. **`supabase/seed.sql`**:
   - Dữ liệu mẫu hoàn chỉnh: Lớp 12A1 Chuyên Toán, Lớp 11B1, 2 khóa học Giải tích & Oxyz, 7 câu hỏi Toán KaTeX chuẩn GDPT 2025 và 1 đề thi thử hoàn chỉnh.

### Các bước nạp vào Supabase Cloud:
1. Đăng nhập [https://supabase.com](https://supabase.com) và tạo một Project mới (miễn phí).
2. Vào mục **SQL Editor** trong thanh menu bên trái.
3. Dán toàn bộ nội dung file `supabase/migrations/20261026000001_initial_schema.sql` và nhấn **Run**.
4. Tiếp tục dán nội dung file `supabase/seed.sql` và nhấn **Run**.
5. Vào **Project Settings -> API**, sao chép:
   - `Project URL` dán vào `NEXT_PUBLIC_SUPABASE_URL` trong `.env.local`
   - `anon public key` dán vào `NEXT_PUBLIC_SUPABASE_ANON_KEY` trong `.env.local`

---

## 🌐 HƯỚNG DẪN TRIỂN KHAI LÊN VERCEL (PRODUCTION)

Website LMS đã được tối ưu hóa 100% để triển khai chỉ với 1 cú click lên **Vercel**:

### Cách 1: Triển khai qua GitHub (Khuyên dùng)
1. Đẩy mã nguồn lên GitHub:
   ```bash
   git add .
   git commit -m "feat: complete THPT Math LMS release"
   git remote add origin https://github.com/<tai-khoan-cua-ban>/thpt-math-lms.git
   git push -u origin master
   ```
2. Truy cập [https://vercel.com](https://vercel.com) và đăng nhập bằng tài khoản GitHub.
3. Nhấn **"Add New..." -> "Project"**, chọn repository `thpt-math-lms`.
4. Trong phần **Environment Variables**, thêm các biến:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY` (Tùy chọn)
5. Nhấn **Deploy**. Vercel sẽ tự động build và cung cấp tên miền Internet miễn phí dạng `https://thpt-math-lms.vercel.app`.

### Cách 2: Triển khai trực tiếp qua Vercel CLI
```bash
npx vercel login
npx vercel deploy --prod
```

---

## 💰 ƯỚC TÍNH CHI PHÍ VẬN HÀNH

Hệ thống được thiết kế tối ưu hóa trên nền tảng miễn phí (Zero Cost / Free Tier):
- **Vercel Hobby Plan**: Miễn phí băng thông 100GB/tháng, đủ phục vụ hàng chục lớp học THPT.
- **Supabase Free Tier**: Miễn phí 500MB Database PostgreSQL, 1GB Storage PDF/ảnh, 50,000 người dùng hoạt động/tháng.
- **Google Gemini API**: Miễn phí gói Free Tier (15 lượt gọi/phút), đáp ứng nhu cầu tạo đề và giải thích toán của giáo viên.
- **Tổng chi phí dự kiến**: **0 VNĐ / tháng** cho quy mô trường học và lớp học phổ thông.

---

## 📜 GIẤY PHÉP
Phát hành theo giấy phép mã nguồn mở MIT License - Phục vụ cộng đồng Giáo dục và Giáo viên Toán Việt Nam.
