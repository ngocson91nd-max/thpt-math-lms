-- Migration: 20261031000001_secure_questions_and_keys.sql
-- Mô tả: Phân tách hoàn toàn schema private cho đáp án & lời giải, bảo vệ câu hỏi bất biến và kích hoạt RLS nghiêm ngặt

-- ====================================================================
-- 1. TẠO SCHEMA RIÊNG CHO DỮ LIỆU NHẠY CẢM (PRIVATE SCHEMA)
-- ====================================================================
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE ALL ON TABLES FROM anon, authenticated;

-- ====================================================================
-- 2. BẢNG CÂU HỎI VÀ PHIÊN BẢN CÂU HỎI (PUBLIC)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.question_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  version INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('single_choice', 'true_false', 'short_answer', 'essay')),
  grade SMALLINT CHECK (grade IN (10, 11, 12)),
  topic TEXT,
  difficulty TEXT CHECK (difficulty IN ('nhan_biet', 'thong_hieu', 'van_dung', 'van_dung_cao')),
  content TEXT NOT NULL,
  options JSONB,
  image_url TEXT,
  lock_options_order BOOLEAN NOT NULL DEFAULT false,
  group_id UUID,                       -- Câu chùm dùng chung dữ kiện/hình vẽ
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, version),
  -- Ràng buộc kiểm tra CHECK: Chặn tuyệt đối rò rỉ đáp án hoặc lời giải vào cột công khai
  CONSTRAINT no_leak_content CHECK (content !~ '\\(True|loigiai|choiceTF|shortans)'),
  CONSTRAINT no_leak_options CHECK (coalesce(options::text, '') !~ '\\\\(True|loigiai)')
);
CREATE INDEX IF NOT EXISTS idx_qv_content_hash ON public.question_versions (content_hash);

-- ====================================================================
-- 3. BẢNG KHÓA ĐÁP ÁN VÀ LỜI GIẢI (PRIVATE - CHỈ SERVICE ROLE ĐỌC/GHI)
-- ====================================================================
CREATE TABLE IF NOT EXISTS private.question_keys (
  question_version_id UUID PRIMARY KEY
    REFERENCES public.question_versions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  key JSONB NOT NULL,        -- Cấu trúc Zod chuẩn xác (QuestionKey)
  explanation TEXT,
  raw_tex TEXT,              -- Mã nguồn TeX gốc chứa \True và \loigiai
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- 4. BẢNG ĐỀ THI VÀ PHIÊN BẢN CÂU HỎI TRONG ĐỀ (PUBLIC)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,                       -- Hạn chót đóng đề thi của toàn bộ lớp
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'closed')),
  solutions_published_at TIMESTAMPTZ,                   -- Thời điểm giáo viên bấm công bố đáp án
  CHECK (closes_at > opens_at)
);

CREATE TABLE IF NOT EXISTS public.exam_questions (
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  position INT NOT NULL,
  question_version_id UUID NOT NULL
    REFERENCES public.question_versions(id) ON DELETE RESTRICT,
  points NUMERIC(4, 2) NOT NULL,
  PRIMARY KEY (exam_id, position),
  UNIQUE (exam_id, question_version_id)
);

-- ====================================================================
-- 5. BẢNG BÀI NỘP VÀ HOÁN VỊ TRỘN ĐỀ (PUBLIC)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline_at TIMESTAMPTZ NOT NULL,       -- min(started_at + duration, closes_at)
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'graded')),
  question_order JSONB NOT NULL,          -- Thứ tự câu hỏi ngẫu nhiên ["<qv_id>", ...]
  option_permutations JSONB NOT NULL,     -- Bảng hoán vị phương án {"<qv_id>": ["C","A","D","B"]}
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,   -- Lưu câu trả lời theo chữ cái hiển thị của HS
  score NUMERIC(5, 2),
  UNIQUE (exam_id, student_id)
);

-- ====================================================================
-- 6. TRIGGER BẢO VỆ CÂU HỎI ĐÃ XUẤT BẢN LÀ BẤT BIẾN (IMMUTABLE)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.forbid_edit_published() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'Cau hoi da xuat ban la bat bien, hay tao phien ban moi!';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_qv_immutable ON public.question_versions;
CREATE TRIGGER trg_qv_immutable BEFORE UPDATE ON public.question_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_edit_published();

-- ====================================================================
-- 7. KÍCH HOẠT ROW LEVEL SECURITY (RLS) VÀ CẤP QUYỀN
-- ====================================================================
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 7.1 Chính sách cho Questions: Giáo viên chỉ quản lý câu hỏi của mình
DROP POLICY IF EXISTS q_owner ON public.questions;
CREATE POLICY q_owner ON public.questions FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

-- 7.2 Chính sách cho Question Versions: Giáo viên chỉ thao tác câu hỏi thuộc sở hữu
DROP POLICY IF EXISTS qv_owner_select ON public.question_versions;
CREATE POLICY qv_owner_select ON public.question_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.questions q
                 WHERE q.id = question_id AND q.owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS qv_owner_insert ON public.question_versions;
CREATE POLICY qv_owner_insert ON public.question_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.questions q
                 WHERE q.id = question_id AND q.owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS qv_owner_update ON public.question_versions;
CREATE POLICY qv_owner_update ON public.question_versions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.questions q
                 WHERE q.id = question_id AND q.owner_id = (SELECT auth.uid())));

-- 7.3 Chính sách cho Exams: Giáo viên toàn quyền với đề của mình; Học sinh chỉ đọc đề mở thuộc lớp của mình
DROP POLICY IF EXISTS exams_owner ON public.exams;
CREATE POLICY exams_owner ON public.exams FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS exams_student_select ON public.exams;
CREATE POLICY exams_student_select ON public.exams FOR SELECT TO authenticated
  USING (status IN ('open', 'closed') AND EXISTS (
    SELECT 1 FROM public.class_members m
    WHERE m.class_id = exams.class_id AND m.user_id = (SELECT auth.uid())
  ));

-- 7.4 Chính sách cho Exam Questions: Chỉ giáo viên được xem/sửa cấu trúc câu hỏi
DROP POLICY IF EXISTS eq_owner ON public.exam_questions;
CREATE POLICY eq_owner ON public.exam_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e
                 WHERE e.id = exam_id AND e.owner_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams e
                 WHERE e.id = exam_id AND e.owner_id = (SELECT auth.uid())));
-- KHÔNG CÓ POLICY NÀO CHO HỌC SINH TRÊN exam_questions và question_versions (Mặc định Deny)

-- 7.5 Chính sách cho Submissions: Học sinh chỉ ĐỌC bài của mình; Giáo viên ĐỌC bài của lớp mình
DROP POLICY IF EXISTS sub_student_select ON public.submissions;
CREATE POLICY sub_student_select ON public.submissions FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS sub_teacher_select ON public.submissions;
CREATE POLICY sub_teacher_select ON public.submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e
                 WHERE e.id = exam_id AND e.owner_id = (SELECT auth.uid())));

-- Thu hồi toàn bộ quyền INSERT, UPDATE, DELETE trực tiếp trên Submissions từ client
REVOKE INSERT, UPDATE, DELETE ON public.submissions FROM anon, authenticated;
