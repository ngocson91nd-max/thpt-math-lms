export type UserRole = 'admin' | 'teacher' | 'student';

export interface Profile {
  id: string;
  email: string;
  username?: string; // Tên đăng nhập không cần email
  candidate_number?: string; // Số báo danh (SBD)
  birth_date?: string; // Ngày sinh
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  school_name?: string;
  grade?: 10 | 11 | 12;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClassItem {
  id: string;
  name: string;
  code: string;
  grade: 10 | 11 | 12;
  academic_year: string;
  teacher_id: string;
  teacher?: Profile;
  description?: string;
  is_active: boolean;
  join_mode?: 'free' | 'approval'; // 'free': Vào tự do, 'approval': Thầy cô duyệt
  join_password?: string; // Mật khẩu tham gia lớp (tùy chọn)
  member_count?: number;
  pending_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ClassMember {
  id: string;
  class_id: string;
  user_id: string;
  candidate_number?: string; // Số báo danh (SBD) của học sinh trong lớp này
  role: 'teacher' | 'student';
  status: 'active' | 'pending' | 'blocked';
  joined_at?: string;
  profile?: Profile;
  student?: Profile;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  grade: 10 | 11 | 12;
  description?: string;
  cover_url?: string;
  teacher_id: string;
  teacher?: Profile;
  is_published: boolean;
  chapters?: Chapter[];
  created_at?: string;
  updated_at?: string;
}

export interface Chapter {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  lessons?: Lesson[];
  created_at?: string;
}

export interface LessonAttachment {
  name: string;
  url: string;
  type: 'pdf' | 'video' | 'image' | 'link';
  size?: number;
}

export interface Lesson {
  id: string;
  chapter_id: string;
  title: string;
  order_index: number;
  content?: string;
  video_url?: string;
  attachments?: LessonAttachment[];
  is_free_preview: boolean;
  created_at?: string;
  updated_at?: string;
}

export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'essay';

export type QuestionDifficulty =
  | 'nhan_biet'
  | 'thong_hieu'
  | 'van_dung'
  | 'van_dung_cao';

export interface SingleChoiceOption {
  id: string; // 'A', 'B', 'C', 'D'
  text: string;
}

export interface TrueFalseStatement {
  id: string; // 'a', 'b', 'c', 'd'
  text: string;
  is_correct?: boolean; // Khi trả về client làm bài thi, không kèm trường này
}

export interface Question {
  id: string;
  teacher_id?: string;
  grade: 10 | 11 | 12;
  topic: string;
  part?: 1 | 2 | 3 | 4;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  content: string; // Đề bài có LaTeX KaTeX
  options?: any; // SingleChoiceOption[] hoặc TrueFalseStatement[]
  correct_answer?: any; // Ẩn khi học sinh đang làm bài thi
  explanation?: string; // Ẩn khi học sinh chưa nộp bài
  points: number;
  is_public: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ExamStatus = 'draft' | 'published' | 'closed';

export interface Exam {
  id: string;
  title: string;
  description?: string;
  class_id?: string;
  class_name?: string;
  teacher_id: string;
  teacher?: Profile;
  grade: 10 | 11 | 12;
  duration_minutes: number;
  passing_score: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  max_attempts: number;
  start_time?: string;
  end_time?: string;
  status: ExamStatus;
  format?: 'standard_3_parts' | 'periodic_4_parts' | 'custom';
  exam_mode?: 'interactive' | 'pdf_view';
  pdf_url?: string;
  solution_pdf_url?: string;
  pdf_total_pages?: number;
  pdf_cut_last_page?: boolean;
  part_structure?: {
    part1_count?: number;
    part2_count?: number;
    part3_count?: number;
    part4_count?: number;
  };
  is_view_answer_allowed: boolean;
  code?: string;
  assigned_classes?: string[];
  access_type?: 'public' | 'restricted';
  no_time_limit?: boolean;
  part_points?: {
    part1?: number;
    part2?: number;
    part3?: number;
    part4?: number;
  };
  true_false_scoring?: 'standard_thpt' | 'equal';
  submission_restriction?: 'anytime' | 'min_time';
  submission_min_minutes?: number;
  violation_action?: 'warning_only' | 'lock_exam';
  max_violations?: number;
  view_answer_policy?: 'immediately' | 'after_closed' | 'specific_time';
  view_score_allowed?: boolean;
  view_leaderboard_allowed?: boolean;
  shuffle_true_false?: boolean;
  is_locked?: boolean;
  submissions_count?: number;
  questions?: (Question & { custom_points?: number; order_index?: number })[];
  created_at?: string;
  updated_at?: string;
}

export type SubmissionStatus = 'in_progress' | 'submitted' | 'grading' | 'graded';

export interface SubmissionAnswer {
  id?: string;
  submission_id?: string;
  question_id: string;
  student_answer: any;
  is_correct?: boolean;
  earned_points: number;
  max_points: number;
  teacher_comment?: string;
  essay_file_url?: string;
}

export interface Submission {
  id: string;
  exam_id: string;
  exam?: Exam;
  student_id: string;
  student?: Profile;
  attempt_number: number;
  start_time: string;
  submitted_at?: string;
  score?: number;
  max_score: number;
  status: SubmissionStatus;
  teacher_feedback?: string;
  ai_feedback?: string;
  answers?: SubmissionAnswer[];
  created_at?: string;
  updated_at?: string;
}

export interface Material {
  id: string;
  teacher_id: string;
  class_id?: string;
  title: string;
  type: 'pdf' | 'video' | 'image' | 'latex_doc';
  file_url: string;
  file_size?: number;
  grade?: 10 | 11 | 12;
  description?: string;
  created_at?: string;
}
