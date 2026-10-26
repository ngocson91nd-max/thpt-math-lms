-- Migration: 20261026000001_initial_schema.sql
-- Mô tả: Khởi tạo toàn bộ cấu trúc cơ sở dữ liệu LMS Toán THPT với Row Level Security (RLS) đầy đủ

-- Bật tiện ích pgcrypto và uuid-ossp nếu chưa có
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 1. BẢNG PROFILES (Hồ sơ người dùng kết nối auth.users)
-- ====================================================================
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

-- ====================================================================
-- 2. BẢNG CLASSES (Lớp học)
-- ====================================================================
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

-- ====================================================================
-- 3. BẢNG CLASS_MEMBERS (Thành viên lớp)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.class_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('teacher', 'student')) DEFAULT 'student',
    status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'blocked')) DEFAULT 'active',
    joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (class_id, user_id)
);

-- ====================================================================
-- 4. BẢNG COURSES (Khóa học / Chuyên đề)
-- ====================================================================
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

-- ====================================================================
-- 5. BẢNG CHAPTERS (Chương bài học)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 6. BẢNG LESSONS (Bài giảng)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 1,
    content TEXT, -- Hỗ trợ Markdown & công thức LaTeX
    video_url TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    is_free_preview BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 7. BẢNG QUESTIONS (Ngân hàng câu hỏi Toán THPT)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    grade INTEGER NOT NULL CHECK (grade IN (10, 11, 12)),
    topic TEXT NOT NULL, -- Ví dụ: "Khảo sát hàm số", "Nguyên hàm - Tích phân", "Hình Oxyz"
    difficulty TEXT NOT NULL CHECK (difficulty IN ('nhan_biet', 'thong_hieu', 'van_dung', 'van_dung_cao')),
    type TEXT NOT NULL CHECK (type IN ('single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay')),
    content TEXT NOT NULL, -- Đề bài (có KaTeX LaTeX)
    options JSONB DEFAULT '[]'::jsonb, -- Danh sách các lựa chọn
    correct_answer JSONB NOT NULL, -- Đáp án đúng (bảo mật, kiểm tra phía máy chủ)
    explanation TEXT, -- Lời giải chi tiết
    points NUMERIC(4, 2) DEFAULT 1.0 NOT NULL,
    is_public BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 8. BẢNG EXAMS (Đề thi & Bài kiểm tra)
-- ====================================================================
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

-- ====================================================================
-- 9. BẢNG EXAM_QUESTIONS (Câu hỏi trong đề thi)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.exam_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 1,
    custom_points NUMERIC(4, 2),
    UNIQUE (exam_id, question_id)
);

-- ====================================================================
-- 10. BẢNG SUBMISSIONS (Bài thi học sinh)
-- ====================================================================
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

-- ====================================================================
-- 11. BẢNG SUBMISSION_ANSWERS (Câu trả lời chi tiết)
-- ====================================================================
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

-- ====================================================================
-- 12. BẢNG MATERIALS (Học liệu Toán: PDF, Video, Hình vẽ, LaTeX)
-- ====================================================================
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
-- HÀM TIỆN ÍCH LẤY VAI TRÒ NGƯỜI DÙNG HIỆN TẠI (HELPER FUNCTION)
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
-- THIẾT LẬP ROW LEVEL SECURITY (RLS) BẢO MẬT TUYỆT ĐỐI
-- ====================================================================

-- 1. PROFILES RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cho phép mọi người dùng đã đăng nhập đọc profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Người dùng tự cập nhật profile của mình"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admin có quyền quản lý toàn bộ profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.get_current_role() = 'admin');

-- 2. CLASSES RLS
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Người dùng xem lớp nếu là admin, giáo viên sở hữu hoặc học sinh trong lớp"
ON public.classes FOR SELECT
TO authenticated
USING (
    public.get_current_role() = 'admin' OR
    teacher_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.class_members cm
        WHERE cm.class_id = classes.id AND cm.user_id = auth.uid() AND cm.status = 'active'
    )
);

CREATE POLICY "Giáo viên và Admin tạo lớp học"
ON public.classes FOR INSERT
TO authenticated
WITH CHECK (
    public.get_current_role() IN ('admin', 'teacher')
);

CREATE POLICY "Giáo viên sở hữu hoặc Admin sửa lớp học"
ON public.classes FOR UPDATE
TO authenticated
USING (
    public.get_current_role() = 'admin' OR teacher_id = auth.uid()
);

CREATE POLICY "Giáo viên sở hữu hoặc Admin xóa lớp học"
ON public.classes FOR DELETE
TO authenticated
USING (
    public.get_current_role() = 'admin' OR teacher_id = auth.uid()
);

-- 3. CLASS_MEMBERS RLS
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Xem thành viên lớp"
ON public.class_members FOR SELECT
TO authenticated
USING (
    public.get_current_role() = 'admin' OR
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = class_members.class_id AND c.teacher_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM public.class_members cm2
        WHERE cm2.class_id = class_members.class_id AND cm2.user_id = auth.uid()
    )
);

CREATE POLICY "Học sinh tham gia lớp bằng mã hoặc GV thêm thành viên"
ON public.class_members FOR INSERT
TO authenticated
WITH CHECK (
    public.get_current_role() = 'admin' OR
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = class_members.class_id AND c.teacher_id = auth.uid()
    )
);

CREATE POLICY "Giáo viên hoặc Admin cập nhật thành viên lớp"
ON public.class_members FOR UPDATE
TO authenticated
USING (
    public.get_current_role() = 'admin' OR
    EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = class_members.class_id AND c.teacher_id = auth.uid()
    )
);

CREATE POLICY "Học sinh rời lớp hoặc GV xóa học sinh khỏi lớp"
ON public.class_members FOR DELETE
TO authenticated
USING (
    public.get_current_role() = 'admin' OR
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = class_members.class_id AND c.teacher_id = auth.uid()
    )
);

-- 4. COURSES RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mọi người dùng xem khóa học đã xuất bản hoặc GV sở hữu"
ON public.courses FOR SELECT
TO authenticated
USING (
    is_published = true OR
    teacher_id = auth.uid() OR
    public.get_current_role() = 'admin'
);

CREATE POLICY "Giáo viên và Admin tạo khóa học"
ON public.courses FOR INSERT
TO authenticated
WITH CHECK (
    public.get_current_role() IN ('admin', 'teacher')
);

CREATE POLICY "Giáo viên sở hữu hoặc Admin sửa khóa học"
ON public.courses FOR UPDATE
TO authenticated
USING (
    public.get_current_role() = 'admin' OR teacher_id = auth.uid()
);

-- 5. CHAPTERS & LESSONS RLS
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Xem chương" ON public.chapters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Quản lý chương" ON public.chapters FOR ALL TO authenticated
USING (public.get_current_role() IN ('admin', 'teacher'));

CREATE POLICY "Xem bài học" ON public.lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Quản lý bài học" ON public.lessons FOR ALL TO authenticated
USING (public.get_current_role() IN ('admin', 'teacher'));

-- 6. QUESTIONS RLS (Ngân hàng câu hỏi Toán)
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Xem câu hỏi Toán"
ON public.questions FOR SELECT
TO authenticated
USING (
    is_public = true OR
    teacher_id = auth.uid() OR
    public.get_current_role() = 'admin'
);

CREATE POLICY "Giáo viên và Admin tạo câu hỏi"
ON public.questions FOR INSERT
TO authenticated
WITH CHECK (
    public.get_current_role() IN ('admin', 'teacher')
);

CREATE POLICY "Giáo viên sở hữu hoặc Admin cập nhật câu hỏi"
ON public.questions FOR UPDATE
TO authenticated
USING (
    public.get_current_role() = 'admin' OR teacher_id = auth.uid()
);

CREATE POLICY "Giáo viên sở hữu hoặc Admin xóa câu hỏi"
ON public.questions FOR DELETE
TO authenticated
USING (
    public.get_current_role() = 'admin' OR teacher_id = auth.uid()
);

-- 7. EXAMS RLS
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Xem đề thi"
ON public.exams FOR SELECT
TO authenticated
USING (
    public.get_current_role() = 'admin' OR
    teacher_id = auth.uid() OR
    (status = 'published' AND (
        class_id IS NULL OR
        EXISTS (
            SELECT 1 FROM public.class_members cm
            WHERE cm.class_id = exams.class_id AND cm.user_id = auth.uid() AND cm.status = 'active'
        )
    ))
);

CREATE POLICY "Giáo viên và Admin tạo và quản lý đề thi"
ON public.exams FOR ALL
TO authenticated
USING (
    public.get_current_role() = 'admin' OR teacher_id = auth.uid()
);

-- 8. EXAM_QUESTIONS RLS
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Xem câu hỏi trong đề" ON public.exam_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Quản lý câu hỏi trong đề" ON public.exam_questions FOR ALL TO authenticated
USING (public.get_current_role() IN ('admin', 'teacher'));

-- 9. SUBMISSIONS RLS (Bài nộp & Điểm)
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Học sinh xem bài làm của mình; GV & Admin xem bài làm thuộc đề thi của họ"
ON public.submissions FOR SELECT
TO authenticated
USING (
    student_id = auth.uid() OR
    public.get_current_role() = 'admin' OR
    EXISTS (
        SELECT 1 FROM public.exams e
        WHERE e.id = submissions.exam_id AND e.teacher_id = auth.uid()
    )
);

CREATE POLICY "Học sinh tạo bài nộp cho chính mình"
ON public.submissions FOR INSERT
TO authenticated
WITH CHECK (
    student_id = auth.uid()
);

CREATE POLICY "Học sinh nộp bài hoặc Giáo viên/Admin chấm bài"
ON public.submissions FOR UPDATE
TO authenticated
USING (
    student_id = auth.uid() OR
    public.get_current_role() = 'admin' OR
    EXISTS (
        SELECT 1 FROM public.exams e
        WHERE e.id = submissions.exam_id AND e.teacher_id = auth.uid()
    )
);

-- 10. SUBMISSION_ANSWERS RLS
ALTER TABLE public.submission_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Xem câu trả lời bài nộp"
ON public.submission_answers FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.id = submission_answers.submission_id AND (
            s.student_id = auth.uid() OR
            public.get_current_role() = 'admin' OR
            EXISTS (
                SELECT 1 FROM public.exams e
                WHERE e.id = s.exam_id AND e.teacher_id = auth.uid()
            )
        )
    )
);

CREATE POLICY "Học sinh lưu câu trả lời hoặc GV cập nhật chấm bài"
ON public.submission_answers FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.id = submission_answers.submission_id AND (
            s.student_id = auth.uid() OR
            public.get_current_role() = 'admin' OR
            EXISTS (
                SELECT 1 FROM public.exams e
                WHERE e.id = s.exam_id AND e.teacher_id = auth.uid()
            )
        )
    )
);

-- 11. MATERIALS RLS (Học liệu Toán)
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Xem học liệu"
ON public.materials FOR SELECT
TO authenticated
USING (
    teacher_id = auth.uid() OR
    public.get_current_role() = 'admin' OR
    class_id IS NULL OR
    EXISTS (
        SELECT 1 FROM public.class_members cm
        WHERE cm.class_id = materials.class_id AND cm.user_id = auth.uid() AND cm.status = 'active'
    )
);

CREATE POLICY "Giáo viên và Admin quản lý học liệu"
ON public.materials FOR ALL
TO authenticated
USING (
    public.get_current_role() IN ('admin', 'teacher')
);
