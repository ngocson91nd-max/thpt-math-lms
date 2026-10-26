-- ====================================================================
-- HỆ THỐNG LMS TOÁN THPT - TOÀN BỘ CẤU TRÚC DATABASE & DỮ LIỆU MẪU
-- Bạn chỉ cần copy TOÀN BỘ file này, dán vào Supabase SQL Editor và nhấn RUN
-- ====================================================================

-- 1. Bật tiện ích mã hóa và UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TẠO TÀI KHOẢN MẪU TRONG AUTH.USERS ĐỂ LIÊN KẾT PROFILE
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@thpt-math-lms.vn', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Quản Trị Viên Hệ Thống"}', now(), now()),
    ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teacher.toan@thpt-math-lms.vn', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Thầy Nguyễn Văn Toán"}', now(), now()),
    ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student.mai@thpt-math-lms.vn', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Nguyễn Thị Mai"}', now(), now()),
    ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student.nam@thpt-math-lms.vn', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Trần Văn Nam"}', now(), now()),
    ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student.dang@thpt-math-lms.vn', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Lê Hải Đăng"}', now(), now())
ON CONFLICT (id) DO NOTHING;

-- 3. BẢNG PROFILES (Hồ sơ người dùng)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')) DEFAULT 'student',
    avatar_url TEXT,
    school_name TEXT DEFAULT 'THPT Chuyên Lê Hồng Phong',
    grade INTEGER CHECK (grade IN (10, 11, 12)) DEFAULT 12,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. BẢNG CLASSES (Lớp học)
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    grade INTEGER NOT NULL CHECK (grade IN (10, 11, 12)),
    academic_year TEXT NOT NULL DEFAULT '2025-2026',
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    description TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. BẢNG CLASS_MEMBERS (Thành viên lớp)
CREATE TABLE IF NOT EXISTS public.class_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('teacher', 'student')) DEFAULT 'student',
    status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'blocked')) DEFAULT 'active',
    joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (class_id, user_id)
);

-- 6. BẢNG COURSES (Khóa học / Chuyên đề)
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    grade INTEGER NOT NULL CHECK (grade IN (10, 11, 12)),
    description TEXT,
    cover_url TEXT,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_published BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. BẢNG CHAPTERS (Chương bài học)
CREATE TABLE IF NOT EXISTS public.chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. BẢNG LESSONS (Bài giảng)
CREATE TABLE IF NOT EXISTS public.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 1,
    content TEXT,
    video_url TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    is_free_preview BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. BẢNG QUESTIONS (Ngân hàng câu hỏi Toán THPT)
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    grade INTEGER NOT NULL CHECK (grade IN (10, 11, 12)),
    topic TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('nhan_biet', 'thong_hieu', 'van_dung', 'van_dung_cao')),
    type TEXT NOT NULL CHECK (type IN ('single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay')),
    content TEXT NOT NULL,
    options JSONB DEFAULT '[]'::jsonb,
    correct_answer JSONB NOT NULL,
    explanation TEXT,
    points NUMERIC(4, 2) DEFAULT 1.0 NOT NULL,
    is_public BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. BẢNG EXAMS (Đề thi & Bài kiểm tra)
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    grade INTEGER NOT NULL CHECK (grade IN (10, 11, 12)),
    duration_minutes INTEGER NOT NULL DEFAULT 45,
    passing_score NUMERIC(4, 2) DEFAULT 5.0 NOT NULL,
    shuffle_questions BOOLEAN DEFAULT true NOT NULL,
    shuffle_options BOOLEAN DEFAULT true NOT NULL,
    max_attempts INTEGER DEFAULT 1 NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'closed')) DEFAULT 'draft',
    is_view_answer_allowed BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. BẢNG EXAM_QUESTIONS (Câu hỏi trong đề thi)
CREATE TABLE IF NOT EXISTS public.exam_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 1,
    custom_points NUMERIC(4, 2),
    UNIQUE (exam_id, question_id)
);

-- 12. BẢNG SUBMISSIONS (Bài thi học sinh)
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    start_time TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    submitted_at TIMESTAMPTZ,
    score NUMERIC(5, 2),
    max_score NUMERIC(5, 2) DEFAULT 10.0 NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted', 'grading', 'graded')) DEFAULT 'in_progress',
    teacher_feedback TEXT,
    ai_feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. BẢNG SUBMISSION_ANSWERS (Câu trả lời chi tiết)
CREATE TABLE IF NOT EXISTS public.submission_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    student_answer JSONB,
    is_correct BOOLEAN,
    earned_points NUMERIC(4, 2) DEFAULT 0 NOT NULL,
    max_points NUMERIC(4, 2) DEFAULT 1.0 NOT NULL,
    teacher_comment TEXT,
    essay_file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (submission_id, question_id)
);

-- 14. BẢNG MATERIALS (Học liệu Toán)
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('pdf', 'video', 'image', 'latex_doc')),
    file_url TEXT NOT NULL,
    file_size BIGINT,
    grade INTEGER CHECK (grade IN (10, 11, 12)),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- HÀM TIỆN ÍCH LẤY VAI TRÒ NGƯỜI DÙNG HIỆN TẠI
-- ====================================================================
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(user_role, 'anonymous');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cho phép mọi người dùng đã đăng nhập đọc profiles" ON public.profiles;
CREATE POLICY "Cho phép mọi người dùng đã đăng nhập đọc profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Người dùng tự cập nhật profile của mình" ON public.profiles;
CREATE POLICY "Người dùng tự cập nhật profile của mình" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admin có quyền quản lý toàn bộ profiles" ON public.profiles;
CREATE POLICY "Admin có quyền quản lý toàn bộ profiles" ON public.profiles FOR ALL TO authenticated USING (public.get_current_role() = 'admin');

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Xem lớp học" ON public.classes;
CREATE POLICY "Xem lớp học" ON public.classes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Giáo viên và Admin tạo lớp học" ON public.classes;
CREATE POLICY "Giáo viên và Admin tạo lớp học" ON public.classes FOR INSERT TO authenticated WITH CHECK (public.get_current_role() IN ('admin', 'teacher'));
DROP POLICY IF EXISTS "Giáo viên sở hữu hoặc Admin sửa lớp học" ON public.classes;
CREATE POLICY "Giáo viên sở hữu hoặc Admin sửa lớp học" ON public.classes FOR UPDATE TO authenticated USING (public.get_current_role() = 'admin' OR teacher_id = auth.uid());
DROP POLICY IF EXISTS "Giáo viên sở hữu hoặc Admin xóa lớp học" ON public.classes;
CREATE POLICY "Giáo viên sở hữu hoặc Admin xóa lớp học" ON public.classes FOR DELETE TO authenticated USING (public.get_current_role() = 'admin' OR teacher_id = auth.uid());

ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Xem thành viên lớp" ON public.class_members;
CREATE POLICY "Xem thành viên lớp" ON public.class_members FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Thêm thành viên lớp" ON public.class_members;
CREATE POLICY "Thêm thành viên lớp" ON public.class_members FOR ALL TO authenticated USING (true);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Xem khóa học" ON public.courses;
CREATE POLICY "Xem khóa học" ON public.courses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Quản lý khóa học" ON public.courses;
CREATE POLICY "Quản lý khóa học" ON public.courses FOR ALL TO authenticated USING (public.get_current_role() IN ('admin', 'teacher'));

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Xem chương" ON public.chapters;
CREATE POLICY "Xem chương" ON public.chapters FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Quản lý chương" ON public.chapters;
CREATE POLICY "Quản lý chương" ON public.chapters FOR ALL TO authenticated USING (public.get_current_role() IN ('admin', 'teacher'));

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Xem bài học" ON public.lessons;
CREATE POLICY "Xem bài học" ON public.lessons FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Quản lý bài học" ON public.lessons;
CREATE POLICY "Quản lý bài học" ON public.lessons FOR ALL TO authenticated USING (public.get_current_role() IN ('admin', 'teacher'));

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Xem câu hỏi Toán" ON public.questions;
CREATE POLICY "Xem câu hỏi Toán" ON public.questions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Quản lý câu hỏi Toán" ON public.questions;
CREATE POLICY "Quản lý câu hỏi Toán" ON public.questions FOR ALL TO authenticated USING (public.get_current_role() IN ('admin', 'teacher'));

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Xem đề thi" ON public.exams;
CREATE POLICY "Xem đề thi" ON public.exams FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Quản lý đề thi" ON public.exams;
CREATE POLICY "Quản lý đề thi" ON public.exams FOR ALL TO authenticated USING (public.get_current_role() IN ('admin', 'teacher'));

ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Xem câu hỏi trong đề" ON public.exam_questions;
CREATE POLICY "Xem câu hỏi trong đề" ON public.exam_questions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Quản lý câu hỏi trong đề" ON public.exam_questions;
CREATE POLICY "Quản lý câu hỏi trong đề" ON public.exam_questions FOR ALL TO authenticated USING (public.get_current_role() IN ('admin', 'teacher'));

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Học sinh xem bài làm của mình" ON public.submissions;
CREATE POLICY "Học sinh xem bài làm của mình" ON public.submissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Tạo bài nộp" ON public.submissions;
CREATE POLICY "Tạo bài nộp" ON public.submissions FOR ALL TO authenticated USING (true);

ALTER TABLE public.submission_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Thao tác chi tiết bài nộp" ON public.submission_answers;
CREATE POLICY "Thao tác chi tiết bài nộp" ON public.submission_answers FOR ALL TO authenticated USING (true);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Xem học liệu" ON public.materials;
CREATE POLICY "Xem học liệu" ON public.materials FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Quản lý học liệu" ON public.materials;
CREATE POLICY "Quản lý học liệu" ON public.materials FOR ALL TO authenticated USING (public.get_current_role() IN ('admin', 'teacher'));

-- ====================================================================
-- DỮ LIỆU MẪU CHUẨN SƯ PHẠM (SEEDS)
-- ====================================================================

-- Hồ sơ người dùng
INSERT INTO public.profiles (id, email, full_name, role, avatar_url, school_name, grade, phone)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin@thpt-math-lms.vn', 'Quản Trị Viên Hệ Thống', 'admin', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', 'Sở Giáo Dục & Đào Tạo', 12, '0901234567'),
    ('22222222-2222-2222-2222-222222222222', 'teacher.toan@thpt-math-lms.vn', 'Thầy Nguyễn Văn Toán', 'teacher', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'THPT Chuyên Lê Hồng Phong', 12, '0912345678'),
    ('33333333-3333-3333-3333-333333333333', 'student.mai@thpt-math-lms.vn', 'Nguyễn Thị Mai', 'student', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', 'THPT Chuyên Lê Hồng Phong', 12, '0923456789'),
    ('44444444-4444-4444-4444-444444444444', 'student.nam@thpt-math-lms.vn', 'Trần Văn Nam', 'student', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', 'THPT Chuyên Lê Hồng Phong', 12, '0934567890'),
    ('55555555-5555-5555-5555-555555555555', 'student.dang@thpt-math-lms.vn', 'Lê Hải Đăng', 'student', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150', 'THPT Chuyên Lê Hồng Phong', 12, '0945678901')
ON CONFLICT (id) DO NOTHING;

-- Lớp học
INSERT INTO public.classes (id, name, code, grade, academic_year, teacher_id, description, is_active)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'Lớp 12A1 - Chuyên Toán & Luyện Thi THPT', 'TOAN12A1-2026', 12, '2025-2026', '22222222-2222-2222-2222-222222222222', 'Lớp học bồi dưỡng nâng cao và luyện đề tốt nghiệp THPT chuẩn format 2025.', true),
    ('c2222222-2222-2222-2222-222222222222', 'Lớp 11B1 - Nền Tảng Giải Tích & Hình Không Gian', 'TOAN11B1-2026', 11, '2025-2026', '22222222-2222-2222-2222-222222222222', 'Nắm vững kiến thức trọng tâm lớp 11 để tạo đà bứt phá kỳ thi đại học.', true)
ON CONFLICT (id) DO NOTHING;

-- Thành viên lớp
INSERT INTO public.class_members (class_id, user_id, role, status)
VALUES
    ('c1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'teacher', 'active'),
    ('c1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'student', 'active'),
    ('c1111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'student', 'active'),
    ('c1111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'student', 'active'),
    ('c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'teacher', 'active')
ON CONFLICT (class_id, user_id) DO NOTHING;

-- Khóa học
INSERT INTO public.courses (id, title, slug, grade, description, cover_url, teacher_id, is_published)
VALUES
    ('d1111111-1111-1111-1111-111111111111', 'Chuyên Đề Ứng Dụng Đạo Hàm Khảo Sát Hàm Số 12', 'chuyen-de-dao-ham-khao-sat-ham-so-12', 12, 'Hệ thống toàn bộ phương pháp tìm cực trị, đồng biến - nghịch biến, tiệm cận và đồ thị hàm số theo chương trình mới.', 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600', '22222222-2222-2222-2222-222222222222', true),
    ('d2222222-2222-2222-2222-222222222222', 'Hình Học Không Gian & Phương Pháp Tọa Độ Trong Không Gian Oxyz', 'hinh-hoc-khong-gian-oxyz-12', 12, 'Từ hình học không gian cổ điển lớp 11 đến phương pháp tọa độ hóa Oxyz giải quyết bài toán khoảng cách và góc.', 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=600', '22222222-2222-2222-2222-222222222222', true)
ON CONFLICT (id) DO NOTHING;

-- Chương bài học
INSERT INTO public.chapters (id, course_id, title, order_index)
VALUES
    ('ca111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'Chương 1: Tính đơn điệu và cực trị của hàm số', 1),
    ('ca222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'Chương 2: Giá trị lớn nhất, nhỏ nhất và Đường tiệm cận', 2)
ON CONFLICT (id) DO NOTHING;

-- Bài học
INSERT INTO public.lessons (id, chapter_id, title, order_index, content, video_url, attachments, is_free_preview)
VALUES
    ('b1111111-1111-1111-1111-111111111111', 'ca111111-1111-1111-1111-111111111111', 'Bài 1: Tính đơn điệu của hàm số và định lý dấu đạo hàm', 1, 
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
  - $y'' > 0$ trên $(-\infty; 0)$ và $(2; +\infty) \implies$ hàm số đồng biến.
  - $y'' < 0$ trên $(0; 2) \implies$ hàm số nghịch biến.', 
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 
    '[{"name": "Tai_lieu_tinh_don_dieu.pdf", "url": "/docs/tinh-don-dieu.pdf", "type": "pdf", "size": 1048576}]'::jsonb, 
    true)
ON CONFLICT (id) DO NOTHING;

-- Ngân hàng câu hỏi Toán THPT
INSERT INTO public.questions (id, teacher_id, grade, topic, difficulty, type, content, options, correct_answer, explanation, points, is_public)
VALUES
    ('a1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 12, 'Khảo sát hàm số', 'nhan_biet', 'single_choice',
    'Cho hàm số $y = f(x)$ có bảng biến thiên với $f''(x) = 3x^2 - 6x$. Số điểm cực trị của hàm số đã cho là:',
    '[{"id": "A", "text": "$0$"}, {"id": "B", "text": "$1$"}, {"id": "C", "text": "$2$"}, {"id": "D", "text": "$3$"}]'::jsonb,
    '"C"'::jsonb,
    'Ta có phương trình $f''(x) = 0 \iff 3x(x - 2) = 0 \iff x = 0$ hoặc $x = 2$. Do đạo hàm đổi dấu khi qua cả 2 nghiệm đơn này nên hàm số có 2 điểm cực trị.',
    0.25, true),

    ('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 12, 'Nguyên hàm - Tích phân', 'thong_hieu', 'single_choice',
    'Tích phân $I = \int_0^1 e^{2x} \, \mathrm{d}x$ bằng:',
    '[{"id": "A", "text": "$\\frac{e^2 - 1}{2}$"}, {"id": "B", "text": "$e^2 - 1$"}, {"id": "C", "text": "$\\frac{e^2}{2}$"}, {"id": "D", "text": "$2(e^2 - 1)$"}]'::jsonb,
    '"A"'::jsonb,
    'Ta có: $I = \left[ \frac{1}{2} e^{2x} \right]_0^1 = \frac{1}{2}(e^2 - e^0) = \frac{e^2 - 1}{2}$.',
    0.25, true),

    ('a3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 12, 'Đường tiệm cận', 'thong_hieu', 'multiple_choice',
    'Cho hàm số $y = \frac{2x - 1}{x + 1}$. Trong các khẳng định sau, những khẳng định nào ĐÚNG? (Chọn tất cả các đáp án đúng)',
    '[{"id": "A", "text": "Đồ thị hàm số có tiệm cận đứng là đường thẳng $x = -1$"}, {"id": "B", "text": "Đồ thị hàm số có tiệm cận ngang là đường thẳng $y = 2$"}, {"id": "C", "text": "Hàm số đồng biến trên toàn bộ $\\mathbb{R}$"}, {"id": "D", "text": "Tâm đối xứng của đồ thị là điểm $I(-1; 2)$"}]'::jsonb,
    '["A", "B", "D"]'::jsonb,
    'Tập xác định $D = \mathbb{R} \setminus \{-1\}$. Tiệm cận đứng $x = -1$, tiệm cận ngang $y = \lim_{x\to \pm\infty}\frac{2x-1}{x+1} = 2$. Tâm đối xứng $I(-1; 2)$. Hàm số chỉ đồng biến trên từng khoảng xác định chứ không đồng biến trên $\mathbb{R}$. Do đó A, B, D đúng.',
    1.0, true),

    ('a4444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 12, 'Khảo sát hàm số', 'van_dung', 'true_false',
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
- Ý c) Cho $f''(x) = 0 \iff x = -1$ hoặc $x = 3$. Qua bảng biến thiên, tại $x = -1$ hàm số đạt cực đại $y_{\text{CĐ}} = -5$, tại $x = 3$ hàm số đạt cực tiểu $y_{\text{CT}} = 3$. Vậy ý c Sai.
- Ý d) Ta có $f(x) = x - 2 + \frac{4}{x - 1}$. Vì $\lim_{x\to\pm\infty} \frac{4}{x - 1} = 0$ nên tiệm cận xiên là $y = x - 2$. (Đúng)',
    1.0, true),

    ('a5555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 12, 'Giá trị lớn nhất, nhỏ nhất', 'thong_hieu', 'short_answer',
    'Tìm giá trị nhỏ nhất của hàm số $g(x) = x + \frac{9}{x}$ trên đoạn $[1; 5]$.',
    '[]'::jsonb,
    '["6", "6.0", "6,0"]'::jsonb,
    'Với $x \in [1; 5]$, ta có $g(x) \ge 2\sqrt{x \cdot \frac{9}{x}} = 6$ (bất đẳng thức AM-GM). Dấu bằng xảy ra khi $x = \frac{9}{x} \iff x^2 = 9 \iff x = 3 \in [1; 5]$. Vậy $\min_{[1; 5]} g(x) = 6$.',
    0.5, true),

    ('a6666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 12, 'Hình học Oxyz', 'van_dung', 'short_answer',
    'Trong không gian $Oxyz$, cho mặt cầu $(S): (x - 1)^2 + (y + 2)^2 + (z - 3)^2 = 25$. Khoảng cách từ tâm $I$ của $(S)$ đến mặt phẳng $(P): 2x - 2y + z + 3 = 0$ bằng bao nhiêu?',
    '[]'::jsonb,
    '["4", "4.0", "4,0"]'::jsonb,
    'Tâm mặt cầu là $I(1; -2; 3)$. Khoảng cách là: $d(I, (P)) = \frac{|2(1) - 2(-2) + 3 + 3|}{\sqrt{2^2 + (-2)^2 + 1^2}} = \frac{|2 + 4 + 3 + 3|}{\sqrt{9}} = \frac{12}{3} = 4$.',
    0.5, true),

    ('a7777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 12, 'Toán thực tế - Ứng dụng đạo hàm', 'van_dung_cao', 'essay',
    'Một hộ sản xuất dự định làm một bể chứa nước bằng inox hình hộp chữ nhật không nắp có thể tích $V = 32\text{ m}^3$, đáy là hình vuông cạnh $x\text{ (m)}$, chiều cao là $h\text{ (m)}$. Hãy tìm kích thước $x$ và $h$ để diện tích inox cần sử dụng là nhỏ nhất (bỏ qua độ dày mối hàn). Trình bày đầy đủ các bước giải.',
    '[]'::jsonb,
    '"Hướng dẫn chấm:
1. Thể tích: $V = x^2 h = 32 \\implies h = \\frac{32}{x^2}$ ($x > 0$). (0.25đ)
2. Diện tích inox: $S(x) = x^2 + 4xh = x^2 + \\frac{128}{x}$. (0.25đ)
3. Đạo hàm: $S''(x) = 2x - \\frac{128}{x^2} = \\frac{2x^3 - 128}{x^2}$. (0.25đ)
4. Cho $S''(x) = 0 \\iff 2x^3 = 128 \\iff x = 4$. Lập bảng biến thiên kết luận $\\min S(x) = S(4)$. Khi đó $x = 4\\text{ m}, h = 2\\text{ m}$. (0.25đ)"'::jsonb,
    'Bài toán tối ưu hóa diện tích inox bể nước: nghiệm tối ưu là cạnh đáy $x = 4\\text{ m}$ và chiều cao $h = 2\\text{ m}$.',
    1.0, true)
ON CONFLICT (id) DO NOTHING;

-- Đề thi mẫu
INSERT INTO public.exams (id, title, description, class_id, teacher_id, grade, duration_minutes, passing_score, shuffle_questions, shuffle_options, max_attempts, status, is_view_answer_allowed)
VALUES
    ('e1111111-1111-1111-1111-111111111111', 'Đề Khảo Sát Toán 12: Đạo Hàm, Tích Phân & Oxyz (Format 2025)', 'Đề thi bao gồm 3 phần: Trắc nghiệm khách quan, Đúng/Sai chuẩn THPT và Trả lời ngắn, Tự luận.', 'c1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 12, 45, 5.0, true, true, 2, 'published', true)
ON CONFLICT (id) DO NOTHING;

-- Gắn câu hỏi vào đề thi
INSERT INTO public.exam_questions (exam_id, question_id, order_index, custom_points)
VALUES
    ('e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 1, 0.25),
    ('e1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 2, 0.25),
    ('e1111111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333', 3, 1.0),
    ('e1111111-1111-1111-1111-111111111111', 'a4444444-4444-4444-4444-444444444444', 4, 1.0),
    ('e1111111-1111-1111-1111-111111111111', 'a5555555-5555-5555-5555-555555555555', 5, 0.5),
    ('e1111111-1111-1111-1111-111111111111', 'a6666666-6666-6666-6666-666666666666', 6, 0.5),
    ('e1111111-1111-1111-1111-111111111111', 'a7777777-7777-7777-7777-777777777777', 7, 1.0)
ON CONFLICT (exam_id, question_id) DO NOTHING;

-- Học liệu mẫu
INSERT INTO public.materials (id, teacher_id, class_id, title, type, file_url, file_size, grade, description)
VALUES
    ('f1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'Tóm Tắt Công Thức Giải Nhanh Toán 12 Chuẩn 2025.pdf', 'pdf', 'https://raw.githubusercontent.com/math-resources/cheatsheet.pdf', 2450000, 12, 'Sổ tay bỏ túi toàn bộ công thức Đạo hàm, Tích phân, Mũ - Logarit, Hình Oxyz.'),
    ('f2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'Video Bài Giảng: Phương Pháp Tọa Độ Hóa Hình Học Không Gian', 'video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', NULL, 12, 'Bí quyết gắn hệ trục Oxyz giải quyết mọi bài toán khoảng cách và góc thi tốt nghiệp.')
ON CONFLICT (id) DO NOTHING;

