-- supabase/seed.sql
-- Dữ liệu mẫu chuẩn sư phạm Toán THPT phục vụ kiểm thử và demo hệ thống LMS

-- 1. TẠO HỒ SƠ TÀI KHOẢN (PROFILES)
-- Lưu ý: Trong Supabase thật, id tham chiếu auth.users(id). Ở đây dùng UUID cố định để seed mẫu
INSERT INTO public.profiles (id, email, full_name, role, avatar_url, school_name, grade, phone)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin@thpt-math-lms.vn', 'Quản Trị Viên Hệ Thống', 'admin', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', 'Sở Giáo Dục & Đào Tạo', 12, '0901234567'),
    ('22222222-2222-2222-2222-222222222222', 'teacher.toan@thpt-math-lms.vn', 'Thầy Nguyễn Văn Toán', 'teacher', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'THPT Chuyên Lê Hồng Phong', 12, '0912345678'),
    ('33333333-3333-3333-3333-333333333333', 'student.mai@thpt-math-lms.vn', 'Nguyễn Thị Mai', 'student', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', 'THPT Chuyên Lê Hồng Phong', 12, '0923456789'),
    ('44444444-4444-4444-4444-444444444444', 'student.nam@thpt-math-lms.vn', 'Trần Văn Nam', 'student', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', 'THPT Chuyên Lê Hồng Phong', 12, '0934567890'),
    ('55555555-5555-5555-5555-555555555555', 'student.dang@thpt-math-lms.vn', 'Lê Hải Đăng', 'student', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150', 'THPT Chuyên Lê Hồng Phong', 12, '0945678901')
ON CONFLICT (id) DO NOTHING;

-- 2. TẠO LỚP HỌC (CLASSES)
INSERT INTO public.classes (id, name, code, grade, academic_year, teacher_id, description, is_active)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'Lớp 12A1 - Chuyên Toán & Luyện Thi THPT', 'TOAN12A1-2026', 12, '2025-2026', '22222222-2222-2222-2222-222222222222', 'Lớp học bồi dưỡng nâng cao và luyện đề tốt nghiệp THPT chuẩn format 2025.', true),
    ('c2222222-2222-2222-2222-222222222222', 'Lớp 11B1 - Nền Tảng Giải Tích & Hình Không Gian', 'TOAN11B1-2026', 11, '2025-2026', '22222222-2222-2222-2222-222222222222', 'Nắm vững kiến thức trọng tâm lớp 11 để tạo đà bứt phá kỳ thi đại học.', true)
ON CONFLICT (id) DO NOTHING;

-- 3. THÊM THÀNH VIÊN VÀO LỚP
INSERT INTO public.class_members (class_id, user_id, role, status)
VALUES
    ('c1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'teacher', 'active'),
    ('c1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'student', 'active'),
    ('c1111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'student', 'active'),
    ('c1111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'student', 'active'),
    ('c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'teacher', 'active')
ON CONFLICT (class_id, user_id) DO NOTHING;

-- 4. TẠO KHÓA HỌC (COURSES)
INSERT INTO public.courses (id, title, slug, grade, description, cover_url, teacher_id, is_published)
VALUES
    ('d1111111-1111-1111-1111-111111111111', 'Chuyên Đề Ứng Dụng Đạo Hàm Khảo Sát Hàm Số 12', 'chuyen-de-dao-ham-khao-sat-ham-so-12', 12, 'Hệ thống toàn bộ phương pháp tìm cực trị, đồng biến - nghịch biến, tiệm cận và đồ thị hàm số theo chương trình mới.', 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600', '22222222-2222-2222-2222-222222222222', true),
    ('d2222222-2222-2222-2222-222222222222', 'Hình Học Không Gian & Phương Pháp Tọa Độ Trong Không Gian Oxyz', 'hinh-hoc-khong-gian-oxyz-12', 12, 'Từ hình học không gian cổ điển lớp 11 đến phương pháp tọa độ hóa Oxyz giải quyết bài toán khoảng cách và góc.', 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=600', '22222222-2222-2222-2222-222222222222', true)
ON CONFLICT (id) DO NOTHING;

-- 5. TẠO CHƯƠNG (CHAPTERS)
INSERT INTO public.chapters (id, course_id, title, order_index)
VALUES
    ('ch111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'Chương 1: Tính đơn điệu và cực trị của hàm số', 1),
    ('ch222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'Chương 2: Giá trị lớn nhất, nhỏ nhất và Đường tiệm cận', 2)
ON CONFLICT (id) DO NOTHING;

-- 6. TẠO BÀI HỌC (LESSONS) CÓ CÔNG THỨC LATEX
INSERT INTO public.lessons (id, chapter_id, title, order_index, content, video_url, attachments, is_free_preview)
VALUES
    ('l1111111-1111-1111-1111-111111111111', 'ch111111-1111-1111-1111-111111111111', 'Bài 1: Tính đơn điệu của hàm số và định lý dấu đạo hàm', 1, 
    '# Bài 1: Tính Đơn Điệu Của Hàm Số

### 1. Định lý mở rộng về tính đơn điệu
Giả sử hàm số $y = f(x)$ có đạo hàm trên khoảng $K$.
- Nếu $f''(x) > 0$ với mọi $x \in K$ thì hàm số **đồng biến** trên khoảng $K$.
- Nếu $f''(x) < 0$ với mọi $x \in K$ thì hàm số **nghịch biến** trên khoảng $K$.
- Nếu $f''(x) \ge 0$ (hoặc $f''(x) \le 0$) với mọi $x \in K$ và dấu bằng chỉ xảy ra tại hữu hạn điểm thuộc $K$ thì hàm số đồng biến (hoặc nghịch biến) trên khoảng $K$.

### 2. Ví dụ áp dụng
Xét tính đơn điệu của hàm số $y = x^3 - 3x^2 + 2$ trên $\mathbb{R}$:
- Tập xác định: $D = \mathbb{R}$.
- Đạo hàm: $y'' = 3x^2 - 6x = 3x(x - 2)$.
- Cho $y'' = 0 \iff x = 0$ hoặc $x = 2$.
- Dấu đạo hàm:
  - $y'' > 0$ trên các khoảng $(-\infty; 0)$ và $(2; +\infty) \implies$ hàm số đồng biến.
  - $y'' < 0$ trên khoảng $(0; 2) \implies$ hàm số nghịch biến.', 
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 
    '[{"name": "Tai_lieu_tinh_don_dieu.pdf", "url": "/docs/tinh-don-dieu.pdf", "type": "pdf", "size": 1048576}]'::jsonb, 
    true),

    ('l2222222-2222-2222-2222-222222222222', 'ch111111-1111-1111-1111-111111111111', 'Bài 2: Cực trị của hàm số và quy tắc I, II', 2,
    '# Bài 2: Cực Trị Của Hàm Số

### 1. Điều kiện cần để hàm số đạt cực trị
Nếu hàm số $y = f(x)$ đạt cực trị tại điểm $x_0$ và nếu hàm số có đạo hàm tại $x_0$ thì $f''(x_0) = 0$.

### 2. Quy tắc tìm cực trị bằng đạo hàm cấp 2
Giả sử $y = f(x)$ có đạo hàm cấp hai trong khoảng $(x_0 - h; x_0 + h)$ với $h > 0$ và $f''(x_0) = 0$:
- Nếu $f''''(x_0) < 0$ thì hàm số đạt **cực đại** tại điểm $x_0$.
- Nếu $f''''(x_0) > 0$ thì hàm số đạt **cực tiểu** tại điểm $x_0$.

$$\Delta = b^2 - 4ac, \quad x_{1,2} = \frac{-b \pm \sqrt{\Delta}}{2a}$$', 
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 
    '[]'::jsonb, 
    false)
ON CONFLICT (id) DO NOTHING;

-- 7. NGÂN HÀNG CÂU HỎI TOÁN THPT (ĐẦY ĐỦ 5 DẠNG CHUẨN BỘ GD&ĐT 2025)
INSERT INTO public.questions (id, teacher_id, grade, topic, difficulty, type, content, options, correct_answer, explanation, points, is_public)
VALUES
    -- Dạng 1: Trắc nghiệm 4 lựa chọn (single_choice)
    ('q1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 12, 'Khảo sát hàm số', 'nhan_biet', 'single_choice',
    'Cho hàm số $y = f(x)$ có bảng biến thiên với $f''(x) = 3x^2 - 6x$. Số điểm cực trị của hàm số đã cho là:',
    '[{"id": "A", "text": "$0$"}, {"id": "B", "text": "$1$"}, {"id": "C", "text": "$2$"}, {"id": "D", "text": "$3$"}]'::jsonb,
    '"C"'::jsonb,
    'Ta có phương trình $f''(x) = 0 \iff 3x(x - 2) = 0 \iff x = 0$ hoặc $x = 2$. Do đạo hàm đổi dấu khi qua cả 2 nghiệm đơn này nên hàm số có 2 điểm cực trị.',
    0.25, true),

    -- Dạng 1: Trắc nghiệm 4 lựa chọn khác (single_choice)
    ('q2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 12, 'Nguyên hàm - Tích phân', 'thong_hieu', 'single_choice',
    'Tích phân $I = \int_0^1 e^{2x} \, \mathrm{d}x$ bằng:',
    '[{"id": "A", "text": "$\\frac{e^2 - 1}{2}$"}, {"id": "B", "text": "$e^2 - 1$"}, {"id": "C", "text": "$\\frac{e^2}{2}$"}, {"id": "D", "text": "$2(e^2 - 1)$"}]'::jsonb,
    '"A"'::jsonb,
    'Ta có: $I = \left[ \frac{1}{2} e^{2x} \right]_0^1 = \frac{1}{2}(e^2 - e^0) = \frac{e^2 - 1}{2}$.',
    0.25, true),

    -- Dạng 2: Trắc nghiệm nhiều lựa chọn (multiple_choice)
    ('q3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 12, 'Đường tiệm cận', 'thong_hieu', 'multiple_choice',
    'Cho hàm số $y = \frac{2x - 1}{x + 1}$. Trong các khẳng định sau, những khẳng định nào ĐÚNG? (Chọn tất cả các đáp án đúng)',
    '[{"id": "A", "text": "Đồ thị hàm số có tiệm cận đứng là đường thẳng $x = -1$"}, {"id": "B", "text": "Đồ thị hàm số có tiệm cận ngang là đường thẳng $y = 2$"}, {"id": "C", "text": "Hàm số đồng biến trên toàn bộ $\\mathbb{R}$"}, {"id": "D", "text": "Tâm đối xứng của đồ thị là điểm $I(-1; 2)$"}]'::jsonb,
    '["A", "B", "D"]'::jsonb,
    'Tập xác định $D = \mathbb{R} \setminus \{-1\}$. Tiệm cận đứng $x = -1$, tiệm cận ngang $y = \lim_{x\to \pm\infty}\frac{2x-1}{x+1} = 2$. Tâm đối xứng $I(-1; 2)$. Hàm số chỉ đồng biến trên từng khoảng xác định chứ không đồng biến trên $\mathbb{R}$. Do đó A, B, D đúng.',
    1.0, true),

    -- Dạng 3: Trắc nghiệm Đúng/Sai 4 ý chuẩn THPT 2025 (true_false)
    ('q4444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 12, 'Khảo sát hàm số', 'van_dung', 'true_false',
    'Cho hàm số $f(x) = \frac{x^2 - 3x + 6}{x - 1}$. Xét tính đúng hoặc sai của các mệnh đề sau:',
    '[
        {"id": "a", "text": "Tập xác định của hàm số là $D = \\mathbb{R} \\setminus \\{1\\}$"},
        {"id": "b", "text": "Đạo hàm của hàm số là $f''(x) = \\frac{x^2 - 2x - 3}{(x - 1)^2}$"},
        {"id": "c", "text": "Hàm số đạt cực đại tại điểm $x = 3$"},
        {"id": "d", "text": "Đường tiệm cận xiên của đồ thị hàm số là đường thẳng $y = x - 2$"}
    ]'::jsonb,
    '{"a": true, "b": true, "c": false, "d": true}'::jsonb,
    'Giải chi tiết:
- Ý a) Đúng vì mẫu thức $x - 1 \ne 0 \iff x \ne 1$.
- Ý b) Ta có $f''(x) = \frac{(2x - 3)(x - 1) - (x^2 - 3x + 6)}{(x - 1)^2} = \frac{x^2 - 2x - 3}{(x - 1)^2}$. (Đúng)
- Ý c) Cho $f''(x) = 0 \iff x = -1$ hoặc $x = 3$. Qua bảng biến thiên, tại $x = -1$ hàm số đạt cực đại $y_{CĐ} = -5$, tại $x = 3$ hàm số đạt cực tiểu $y_{CT} = 3$. Vậy ý c Sai.
- Ý d) Ta có $f(x) = x - 2 + \frac{4}{x - 1}$. Vì $\lim_{x\to\pm\infty} \frac{4}{x - 1} = 0$ nên tiệm cận xiên là $y = x - 2$. (Đúng)',
    1.0, true),

    -- Dạng 4: Trả lời ngắn / Điền đáp số (short_answer)
    ('q5555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 12, 'Giá trị lớn nhất, nhỏ nhất', 'thong_hieu', 'short_answer',
    'Tìm giá trị nhỏ nhất của hàm số $g(x) = x + \frac{9}{x}$ trên đoạn $[1; 5]$.',
    '[]'::jsonb,
    '["6", "6.0", "6,0"]'::jsonb,
    'Với $x \in [1; 5]$, ta có $g(x) \ge 2\sqrt{x \cdot \frac{9}{x}} = 6$ (bất đẳng thức AM-GM). Dấu bằng xảy ra khi $x = \frac{9}{x} \iff x^2 = 9 \iff x = 3 \in [1; 5]$. Vậy $\min_{[1; 5]} g(x) = 6$.',
    0.5, true),

    -- Dạng 4: Trả lời ngắn khác (Hình học Oxyz)
    ('q6666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 12, 'Hình học Oxyz', 'van_dung', 'short_answer',
    'Trong không gian $Oxyz$, cho mặt cầu $(S): (x - 1)^2 + (y + 2)^2 + (z - 3)^2 = 25$. Khoảng cách từ tâm $I$ của $(S)$ đến mặt phẳng $(P): 2x - 2y + z + 3 = 0$ bằng bao nhiêu?',
    '[]'::jsonb,
    '["4", "4.0", "4,0"]'::jsonb,
    'Tâm mặt cầu là $I(1; -2; 3)$. Khoảng cách là: $d(I, (P)) = \frac{|2(1) - 2(-2) + 3 + 3|}{\sqrt{2^2 + (-2)^2 + 1^2}} = \frac{|2 + 4 + 3 + 3|}{\sqrt{9}} = \frac{12}{3} = 4$.',
    0.5, true),

    -- Dạng 5: Tự luận (essay)
    ('q7777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 12, 'Toán thực tế - Ứng dụng đạo hàm', 'van_dung_cao', 'essay',
    'Một hộ sản xuất dự định làm một bể chứa nước bằng inox hình hộp chữ nhật không nắp có thể tích $V = 32\text{ m}^3$, đáy là hình vuông cạnh $x\text{ (m)}$, chiều cao là $h\text{ (m)}$. Hãy tìm kích thước $x$ và $h$ để diện tích inox cần sử dụng là nhỏ nhất (bỏ qua độ dày mối hàn). Trình bày đầy đủ các bước giải.',
    '[]'::jsonb,
    '"Hướng dẫn chấm:
1. Xác định công thức thể tích: $V = x^2 h = 32 \\implies h = \\frac{32}{x^2}$ ($x > 0$). (0.25đ)
2. Thiết lập hàm diện tích toàn phần không nắp: $S(x) = x^2 + 4xh = x^2 + \\frac{128}{x}$. (0.25đ)
3. Tính đạo hàm: $S''(x) = 2x - \\frac{128}{x^2} = \\frac{2x^3 - 128}{x^2}$. (0.25đ)
4. Cho $S''(x) = 0 \\iff 2x^3 = 128 \\iff x = 4$. Lập bảng biến thiên kết luận $\\min S(x) = S(4)$. Khi đó $x = 4\\text{ m}, h = \\frac{32}{16} = 2\\text{ m}$. (0.25đ)"'::jsonb,
    'Bài toán tối ưu hóa diện tích bề mặt bể nước inox: nghiệm tối ưu là cạnh đáy $x = 4\\text{ m}$ và chiều cao $h = 2\\text{ m}$.',
    1.0, true)
ON CONFLICT (id) DO NOTHING;

-- 8. TẠO ĐỀ THI MẪU (EXAMS)
INSERT INTO public.exams (id, title, description, class_id, teacher_id, grade, duration_minutes, passing_score, shuffle_questions, shuffle_options, max_attempts, status, is_view_answer_allowed)
VALUES
    ('e1111111-1111-1111-1111-111111111111', 'Đề Khảo Sát Toán 12: Đạo Hàm, Tích Phân & Oxyz (Format 2025)', 'Đề thi bao gồm 3 phần: Trắc nghiệm khách quan, Đúng/Sai chuẩn THPT và Trả lời ngắn.', 'c1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 12, 45, 5.0, true, true, 2, 'published', true)
ON CONFLICT (id) DO NOTHING;

-- 9. GẮN CÂU HỎI VÀO ĐỀ THI (EXAM_QUESTIONS)
INSERT INTO public.exam_questions (exam_id, question_id, order_index, custom_points)
VALUES
    ('e1111111-1111-1111-1111-111111111111', 'q1111111-1111-1111-1111-111111111111', 1, 0.25),
    ('e1111111-1111-1111-1111-111111111111', 'q2222222-2222-2222-2222-222222222222', 2, 0.25),
    ('e1111111-1111-1111-1111-111111111111', 'q3333333-3333-3333-3333-333333333333', 3, 1.0),
    ('e1111111-1111-1111-1111-111111111111', 'q4444444-4444-4444-4444-444444444444', 4, 1.0),
    ('e1111111-1111-1111-1111-111111111111', 'q5555555-5555-5555-5555-555555555555', 5, 0.5),
    ('e1111111-1111-1111-1111-111111111111', 'q6666666-6666-6666-6666-666666666666', 6, 0.5),
    ('e1111111-1111-1111-1111-111111111111', 'q7777777-7777-7777-7777-777777777777', 7, 1.0)
ON CONFLICT (exam_id, question_id) DO NOTHING;

-- 10. TẠO HỌC LIỆU MẪU (MATERIALS)
INSERT INTO public.materials (id, teacher_id, class_id, title, type, file_url, file_size, grade, description)
VALUES
    ('m1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'Tóm Tắt Công Thức Giải Nhanh Toán 12 Chuẩn 2025.pdf', 'pdf', 'https://raw.githubusercontent.com/math-resources/cheatsheet.pdf', 2450000, 12, 'Sổ tay bỏ túi toàn bộ công thức Đạo hàm, Tích phân, Mũ - Logarit, Hình Oxyz.'),
    ('m2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'Video Bài Giảng: Phương Pháp Tọa Độ Hóa Hình Học Không Gian', 'video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', NULL, 12, 'Bí quyết gắn hệ trục Oxyz giải quyết mọi bài toán khoảng cách và góc thi tốt nghiệp.')
ON CONFLICT (id) DO NOTHING;
