import {
  Profile,
  ClassItem,
  Course,
  Question,
  Exam,
  Submission,
  Material,
  ClassMember,
} from '@/types/database';

export const MOCK_USERS: Profile[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@thpt-math-lms.vn',
    full_name: 'Quản Trị Viên Hệ Thống',
    role: 'admin',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    school_name: 'Sở Giáo Dục & Đào Tạo',
    grade: 12,
    phone: '0901234567',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'teacher.toan@thpt-math-lms.vn',
    full_name: 'Thầy Nguyễn Văn Toán',
    role: 'teacher',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    school_name: 'THPT Chuyên Lê Hồng Phong',
    grade: 12,
    phone: '0912345678',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'student.mai@thpt-math-lms.vn',
    full_name: 'Nguyễn Thị Mai',
    role: 'student',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    school_name: 'THPT Chuyên Lê Hồng Phong',
    grade: 12,
    phone: '0923456789',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'student.nam@thpt-math-lms.vn',
    full_name: 'Trần Văn Nam',
    role: 'student',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    school_name: 'THPT Chuyên Lê Hồng Phong',
    grade: 12,
    phone: '0934567890',
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    email: 'student.dang@thpt-math-lms.vn',
    full_name: 'Lê Hải Đăng',
    role: 'student',
    avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
    school_name: 'THPT Chuyên Lê Hồng Phong',
    grade: 12,
    phone: '0945678901',
  },
];

export const MOCK_CLASSES: ClassItem[] = [
  {
    id: 'c1111111-1111-1111-1111-111111111111',
    name: 'Lớp 12A1 - Chuyên Toán & Luyện Thi THPT',
    code: 'TOAN12A1-2026',
    grade: 12,
    academic_year: '2025-2026',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    description: 'Lớp học bồi dưỡng nâng cao và luyện đề tốt nghiệp THPT chuẩn format 2025 của Bộ GD&ĐT.',
    is_active: true,
    member_count: 36,
  },
  {
    id: 'c2222222-2222-2222-2222-222222222222',
    name: 'Lớp 11B1 - Nền Tảng Giải Tích & Hình Không Gian',
    code: 'TOAN11B1-2026',
    grade: 11,
    academic_year: '2025-2026',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    description: 'Nắm vững kiến thức trọng tâm lớp 11 để tạo đà bứt phá kỳ thi đại học.',
    is_active: true,
    member_count: 42,
  },
];

export const MOCK_CLASS_MEMBERS: ClassMember[] = [
  {
    id: 'cm1',
    class_id: 'c1111111-1111-1111-1111-111111111111',
    user_id: '33333333-3333-3333-3333-333333333333',
    role: 'student',
    status: 'active',
    profile: MOCK_USERS[2],
  },
  {
    id: 'cm2',
    class_id: 'c1111111-1111-1111-1111-111111111111',
    user_id: '44444444-4444-4444-4444-444444444444',
    role: 'student',
    status: 'active',
    profile: MOCK_USERS[3],
  },
  {
    id: 'cm3',
    class_id: 'c1111111-1111-1111-1111-111111111111',
    user_id: '55555555-5555-5555-5555-555555555555',
    role: 'student',
    status: 'active',
    profile: MOCK_USERS[4],
  },
];

export const MOCK_COURSES: Course[] = [
  {
    id: 'd1111111-1111-1111-1111-111111111111',
    title: 'Chuyên Đề Ứng Dụng Đạo Hàm Khảo Sát Hàm Số 12',
    slug: 'chuyen-de-dao-ham-khao-sat-ham-so-12',
    grade: 12,
    description: 'Hệ thống toàn bộ phương pháp tìm cực trị, đồng biến - nghịch biến, tiệm cận và đồ thị hàm số theo chương trình mới.',
    cover_url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    is_published: true,
    chapters: [
      {
        id: 'ch1',
        course_id: 'd1111111-1111-1111-1111-111111111111',
        title: 'Chương 1: Tính đơn điệu và cực trị của hàm số',
        order_index: 1,
        lessons: [
          {
            id: 'l1',
            chapter_id: 'ch1',
            title: 'Bài 1: Tính đơn điệu của hàm số và định lý dấu đạo hàm',
            order_index: 1,
            content: `# Bài 1: Tính Đơn Điệu Của Hàm Số

### 1. Định lý mở rộng về tính đơn điệu
Giả sử hàm số $y = f(x)$ có đạo hàm trên khoảng $K$.
- Nếu $f'(x) > 0$ với mọi $x \\in K$ thì hàm số **đồng biến** trên khoảng $K$.
- Nếu $f'(x) < 0$ với mọi $x \\in K$ thì hàm số **nghịch biến** trên khoảng $K$.
- Nếu $f'(x) \\ge 0$ (hoặc $f'(x) \\le 0$) với mọi $x \\in K$ và dấu bằng chỉ xảy ra tại hữu hạn điểm thuộc $K$ thì hàm số đồng biến (hoặc nghịch biến) trên khoảng $K$.

### 2. Ví dụ áp dụng
Xét tính đơn điệu của hàm số $y = x^3 - 3x^2 + 2$ trên $\\mathbb{R}$:
- Tập xác định: $D = \\mathbb{R}$.
- Đạo hàm: $y' = 3x^2 - 6x = 3x(x - 2)$.
- Cho $y' = 0 \\iff x = 0$ hoặc $x = 2$.
- Dấu đạo hàm:
  - $y' > 0$ trên $(-\\infty; 0)$ và $(2; +\\infty) \\implies$ hàm số đồng biến.
  - $y' < 0$ trên $(0; 2) \\implies$ hàm số nghịch biến.`,
            video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            attachments: [
              {
                name: 'Tai_lieu_tinh_don_dieu.pdf',
                url: '/docs/tinh-don-dieu.pdf',
                type: 'pdf',
                size: 1048576,
              },
            ],
            is_free_preview: true,
          },
          {
            id: 'l2',
            chapter_id: 'ch1',
            title: 'Bài 2: Cực trị của hàm số và quy tắc I, II',
            order_index: 2,
            content: `# Bài 2: Cực Trị Của Hàm Số

### 1. Điều kiện cần để hàm số đạt cực trị
Nếu hàm số $y = f(x)$ đạt cực trị tại điểm $x_0$ và nếu hàm số có đạo hàm tại $x_0$ thì $f'(x_0) = 0$.

### 2. Quy tắc tìm cực trị bằng đạo hàm cấp 2
Giả sử $y = f(x)$ có đạo hàm cấp hai trong khoảng $(x_0 - h; x_0 + h)$ với $h > 0$ và $f'(x_0) = 0$:
- Nếu $f''(x_0) < 0$ thì hàm số đạt **cực đại** tại điểm $x_0$.
- Nếu $f''(x_0) > 0$ thì hàm số đạt **cực tiểu** tại điểm $x_0$.

$$\\Delta = b^2 - 4ac, \\quad x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$$`,
            video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            attachments: [],
            is_free_preview: false,
          },
        ],
      },
    ],
  },
  {
    id: 'd2222222-2222-2222-2222-222222222222',
    title: 'Hình Học Không Gian & Phương Pháp Tọa Độ Oxyz',
    slug: 'hinh-hoc-khong-gian-oxyz-12',
    grade: 12,
    description: 'Từ hình học không gian cổ điển lớp 11 đến phương pháp tọa độ hóa Oxyz giải quyết bài toán khoảng cách và góc.',
    cover_url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=600',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    is_published: true,
  },
];

export const MOCK_QUESTIONS: Question[] = [
  {
    id: 'a1111111-1111-1111-1111-111111111111',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    grade: 12,
    topic: 'Khảo sát hàm số',
    difficulty: 'nhan_biet',
    type: 'single_choice',
    content: 'Cho hàm số $y = f(x)$ có bảng biến thiên với $f\'(x) = 3x^2 - 6x$. Số điểm cực trị của hàm số đã cho là:',
    options: [
      { id: 'A', text: '$0$' },
      { id: 'B', text: '$1$' },
      { id: 'C', text: '$2$' },
      { id: 'D', text: '$3$' },
    ],
    correct_answer: 'C',
    explanation: 'Ta có phương trình $f\'(x) = 0 \\iff 3x(x - 2) = 0 \\iff x = 0$ hoặc $x = 2$. Do đạo hàm đổi dấu khi qua cả 2 nghiệm đơn này nên hàm số có 2 điểm cực trị.',
    points: 0.25,
    is_public: true,
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    grade: 12,
    topic: 'Nguyên hàm - Tích phân',
    difficulty: 'thong_hieu',
    type: 'single_choice',
    content: 'Tích phân $I = \\int_0^1 e^{2x} \\, \\mathrm{d}x$ bằng:',
    options: [
      { id: 'A', text: '$\\frac{e^2 - 1}{2}$' },
      { id: 'B', text: '$e^2 - 1$' },
      { id: 'C', text: '$\\frac{e^2}{2}$' },
      { id: 'D', text: '$2(e^2 - 1)$' },
    ],
    correct_answer: 'A',
    explanation: 'Ta có: $I = \\left[ \\frac{1}{2} e^{2x} \\right]_0^1 = \\frac{1}{2}(e^2 - e^0) = \\frac{e^2 - 1}{2}$.',
    points: 0.25,
    is_public: true,
  },
  {
    id: 'a3333333-3333-3333-3333-333333333333',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    grade: 12,
    topic: 'Đường tiệm cận',
    difficulty: 'thong_hieu',
    type: 'multiple_choice',
    content: 'Cho hàm số $y = \\frac{2x - 1}{x + 1}$. Trong các khẳng định sau, những khẳng định nào ĐÚNG? (Chọn tất cả các đáp án đúng)',
    options: [
      { id: 'A', text: 'Đồ thị hàm số có tiệm cận đứng là đường thẳng $x = -1$' },
      { id: 'B', text: 'Đồ thị hàm số có tiệm cận ngang là đường thẳng $y = 2$' },
      { id: 'C', text: 'Hàm số đồng biến trên toàn bộ $\\mathbb{R}$' },
      { id: 'D', text: 'Tâm đối xứng của đồ thị là điểm $I(-1; 2)$' },
    ],
    correct_answer: ['A', 'B', 'D'],
    explanation: 'Tập xác định $D = \\mathbb{R} \\setminus \\{-1\\}$. Tiệm cận đứng $x = -1$, tiệm cận ngang $y = \\lim_{x\\to \\pm\\infty}\\frac{2x-1}{x+1} = 2$. Tâm đối xứng $I(-1; 2)$. Hàm số chỉ đồng biến trên từng khoảng xác định chứ không đồng biến trên toàn $\\mathbb{R}$. Do đó A, B, D đúng.',
    points: 1.0,
    is_public: true,
  },
  {
    id: 'a4444444-4444-4444-4444-444444444444',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    grade: 12,
    topic: 'Khảo sát hàm số',
    difficulty: 'van_dung',
    type: 'true_false',
    content: 'Cho hàm số $f(x) = \\frac{x^2 - 3x + 6}{x - 1}$. Xét tính đúng hoặc sai của các mệnh đề sau:',
    options: [
      { id: 'a', text: 'Tập xác định của hàm số là $D = \\mathbb{R} \\setminus \\{1\\}$' },
      { id: 'b', text: 'Đạo hàm của hàm số là $f\'(x) = \\frac{x^2 - 2x - 3}{(x - 1)^2}$' },
      { id: 'c', text: 'Hàm số đạt cực đại tại điểm $x = 3$' },
      { id: 'd', text: 'Đường tiệm cận xiên của đồ thị hàm số là đường thẳng $y = x - 2$' },
    ],
    correct_answer: { a: true, b: true, c: false, d: true },
    explanation: `Giải chi tiết:
- Ý a) Đúng vì mẫu thức $x - 1 \\ne 0 \\iff x \\ne 1$.
- Ý b) Ta có $f'(x) = \\frac{(2x - 3)(x - 1) - (x^2 - 3x + 6)}{(x - 1)^2} = \\frac{x^2 - 2x - 3}{(x - 1)^2}$. (Đúng)
- Ý c) Cho $f'(x) = 0 \\iff x = -1$ hoặc $x = 3$. Qua bảng biến thiên, tại $x = -1$ hàm số đạt cực đại $y_{\\text{CĐ}} = -5$, tại $x = 3$ hàm số đạt cực tiểu $y_{\\text{CT}} = 3$. Vậy ý c Sai.
- Ý d) Ta có $f(x) = x - 2 + \\frac{4}{x - 1}$. Vì $\\lim_{x\\to\\pm\\infty} \\frac{4}{x - 1} = 0$ nên tiệm cận xiên là $y = x - 2$. (Đúng)`,
    points: 1.0,
    is_public: true,
  },
  {
    id: 'a5555555-5555-5555-5555-555555555555',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    grade: 12,
    topic: 'Giá trị lớn nhất, nhỏ nhất',
    difficulty: 'thong_hieu',
    type: 'short_answer',
    content: 'Tìm giá trị nhỏ nhất của hàm số $g(x) = x + \\frac{9}{x}$ trên đoạn $[1; 5]$.',
    options: [],
    correct_answer: ['6', '6.0', '6,0'],
    explanation: 'Với $x \\in [1; 5]$, ta có $g(x) \\ge 2\\sqrt{x \\cdot \\frac{9}{x}} = 6$ (bất đẳng thức AM-GM). Dấu bằng xảy ra khi $x = \\frac{9}{x} \\iff x^2 = 9 \\iff x = 3 \\in [1; 5]$. Vậy $\\min_{[1; 5]} g(x) = 6$.',
    points: 0.5,
    is_public: true,
  },
  {
    id: 'a6666666-6666-6666-6666-666666666666',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    grade: 12,
    topic: 'Hình học Oxyz',
    difficulty: 'van_dung',
    type: 'short_answer',
    content: 'Trong không gian $Oxyz$, cho mặt cầu $(S): (x - 1)^2 + (y + 2)^2 + (z - 3)^2 = 25$. Khoảng cách từ tâm $I$ của $(S)$ đến mặt phẳng $(P): 2x - 2y + z + 3 = 0$ bằng bao nhiêu?',
    options: [],
    correct_answer: ['4', '4.0', '4,0'],
    explanation: 'Tâm mặt cầu là $I(1; -2; 3)$. Khoảng cách là: $d(I, (P)) = \\frac{|2(1) - 2(-2) + 3 + 3|}{\\sqrt{2^2 + (-2)^2 + 1^2}} = \\frac{|2 + 4 + 3 + 3|}{\\sqrt{9}} = \\frac{12}{3} = 4$.',
    points: 0.5,
    is_public: true,
  },
  {
    id: 'a7777777-7777-7777-7777-777777777777',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    grade: 12,
    topic: 'Toán thực tế - Ứng dụng đạo hàm',
    difficulty: 'van_dung_cao',
    type: 'essay',
    content: 'Một hộ sản xuất dự định làm một bể chứa nước bằng inox hình hộp chữ nhật không nắp có thể tích $V = 32\\text{ m}^3$, đáy là hình vuông cạnh $x\\text{ (m)}$, chiều cao là $h\\text{ (m)}$. Hãy tìm kích thước $x$ và $h$ để diện tích inox cần sử dụng là nhỏ nhất (bỏ qua độ dày mối hàn). Trình bày đầy đủ các bước giải.',
    options: [],
    correct_answer: `Hướng dẫn chấm:
1. Thể tích: $V = x^2 h = 32 \\implies h = \\frac{32}{x^2}$ ($x > 0$). (0.25đ)
2. Diện tích inox không nắp: $S(x) = x^2 + 4xh = x^2 + \\frac{128}{x}$. (0.25đ)
3. Đạo hàm: $S'(x) = 2x - \\frac{128}{x^2} = \\frac{2x^3 - 128}{x^2}$. (0.25đ)
4. Cho $S'(x) = 0 \\iff 2x^3 = 128 \\iff x = 4$. Lập bảng biến thiên kết luận $\\min S(x) = S(4)$. Khi đó $x = 4\\text{ m}, h = 2\\text{ m}$. (0.25đ)`,
    explanation: 'Bài toán tối ưu hóa diện tích inox bể nước: nghiệm tối ưu là cạnh đáy $x = 4\\text{ m}$ và chiều cao $h = 2\\text{ m}$.',
    points: 1.0,
    is_public: true,
  },
];

export const MOCK_EXAMS: Exam[] = [
  {
    id: 'e1111111-1111-1111-1111-111111111111',
    title: 'Đề Khảo Sát Toán 12: Đạo Hàm, Tích Phân & Oxyz (Format 2025)',
    description: 'Đề thi bao gồm 3 phần: Trắc nghiệm khách quan, Đúng/Sai chuẩn THPT và Trả lời ngắn, Tự luận.',
    class_id: 'c1111111-1111-1111-1111-111111111111',
    class_name: 'Lớp 12A1 - Chuyên Toán & Luyện Thi THPT',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    grade: 12,
    duration_minutes: 45,
    passing_score: 5.0,
    shuffle_questions: true,
    shuffle_options: true,
    max_attempts: 3,
    status: 'published',
    is_view_answer_allowed: true,
    questions: MOCK_QUESTIONS.map((q, idx) => ({ ...q, order_index: idx + 1, custom_points: q.points })),
  },
  {
    id: 'e2222222-2222-2222-2222-222222222222',
    title: 'Đề Thi Thử Tốt Nghiệp THPT 2025 Môn Toán (90 Phút - Chuẩn Bộ GD&ĐT)',
    description: 'Đề thi phân hóa cao độ, bấm giờ 90 phút nghiêm túc gồm đầy đủ các mức độ Nhận biết, Thông hiểu, Vận dụng và Vận dụng cao.',
    class_id: 'c1111111-1111-1111-1111-111111111111',
    class_name: 'Lớp 12A1 - Chuyên Toán & Luyện Thi THPT',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    grade: 12,
    duration_minutes: 90,
    passing_score: 5.0,
    shuffle_questions: true,
    shuffle_options: true,
    max_attempts: 2,
    status: 'published',
    is_view_answer_allowed: true,
    questions: MOCK_QUESTIONS.map((q, idx) => ({ ...q, order_index: idx + 1, custom_points: q.points })),
  },
  {
    id: 'e3333333-3333-3333-3333-333333333333',
    title: 'Đề Ôn Tập Định Kỳ Toán 11: Dãy Số, Cấp Số Cộng & Cấp Số Nhân',
    description: 'Kiểm tra kiến thức đại số & giải tích lớp 11: Công thức số hạng tổng quát, tính tổng n số hạng đầu và bài toán lãi suất ngân hàng.',
    class_id: 'c2222222-2222-2222-2222-222222222222',
    class_name: 'Lớp 11A2 - Ôn Luyện Định Kỳ',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    grade: 11,
    duration_minutes: 45,
    passing_score: 5.0,
    shuffle_questions: true,
    shuffle_options: true,
    max_attempts: 3,
    status: 'published',
    is_view_answer_allowed: true,
    questions: MOCK_QUESTIONS.slice(0, 5).map((q, idx) => ({ ...q, order_index: idx + 1, custom_points: q.points })),
  },
  {
    id: 'e4444444-4444-4444-4444-444444444444',
    title: 'Đề Ôn Tập Chuyên Đề Toán 10: Hàm Số Bậc Hai & Bất Phương Trình',
    description: 'Đề ôn tập rèn luyện kỹ năng xét dấu tam thức bậc hai, đồ thị parabol và giải bất phương trình bậc hai một ẩn.',
    class_id: 'c3333333-3333-3333-3333-333333333333',
    class_name: 'Lớp 10A1 - Nền Tảng Toán THPT',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    grade: 10,
    duration_minutes: 45,
    passing_score: 5.0,
    shuffle_questions: true,
    shuffle_options: true,
    max_attempts: 3,
    status: 'published',
    is_view_answer_allowed: true,
    questions: MOCK_QUESTIONS.slice(0, 5).map((q, idx) => ({ ...q, order_index: idx + 1, custom_points: q.points })),
  },
];

export const MOCK_SUBMISSIONS: Submission[] = [
  {
    id: 'sub-001',
    exam_id: 'e1111111-1111-1111-1111-111111111111',
    student_id: '33333333-3333-3333-3333-333333333333',
    student: MOCK_USERS[2],
    attempt_number: 1,
    start_time: '2026-10-25T08:00:00Z',
    submitted_at: '2026-10-25T08:35:00Z',
    score: 8.75,
    max_score: 10.0,
    status: 'graded',
    teacher_feedback: 'Em làm bài rất tốt, câu tự luận trình bày logic, cần chú ý tính toán cẩn thận hơn ở câu tiệm cận xiên.',
    ai_feedback: 'Học sinh nắm vững kiến thức khảo sát hàm số và tích phân. Kỹ năng vận dụng cao đạt mức Khá-Giỏi.',
    answers: [
      { question_id: 'a1111111-1111-1111-1111-111111111111', student_answer: 'C', is_correct: true, earned_points: 0.25, max_points: 0.25 },
      { question_id: 'a2222222-2222-2222-2222-222222222222', student_answer: 'A', is_correct: true, earned_points: 0.25, max_points: 0.25 },
      { question_id: 'a3333333-3333-3333-3333-333333333333', student_answer: ['A', 'B', 'D'], is_correct: true, earned_points: 1.0, max_points: 1.0 },
      { question_id: 'a4444444-4444-4444-4444-444444444444', student_answer: { a: true, b: true, c: false, d: true }, is_correct: true, earned_points: 1.0, max_points: 1.0 },
      { question_id: 'a5555555-5555-5555-5555-555555555555', student_answer: '6', is_correct: true, earned_points: 0.5, max_points: 0.5 },
      { question_id: 'a6666666-6666-6666-6666-666666666666', student_answer: '4', is_correct: true, earned_points: 0.5, max_points: 0.5 },
      { question_id: 'a7777777-7777-7777-7777-777777777777', student_answer: 'Em đặt hàm S(x) = x^2 + 128/x, đạo hàm S\'(x) = 2x - 128/x^2 = 0 <=> x = 4 (m). Chiều cao h = 32/16 = 2 (m).', is_correct: true, earned_points: 1.0, max_points: 1.0, teacher_comment: 'Trình bày ngắn gọn, kết quả chính xác.' },
    ],
  },
  {
    id: 'sub-002',
    exam_id: 'e1111111-1111-1111-1111-111111111111',
    student_id: '44444444-4444-4444-4444-444444444444',
    student: MOCK_USERS[3],
    attempt_number: 1,
    start_time: '2026-10-25T09:00:00Z',
    submitted_at: '2026-10-25T09:42:00Z',
    score: 6.5,
    max_score: 10.0,
    status: 'grading',
    teacher_feedback: 'Bài làm ở mức khá, cần ôn thêm dạng toán thực tế.',
    answers: [
      { question_id: 'a1111111-1111-1111-1111-111111111111', student_answer: 'C', is_correct: true, earned_points: 0.25, max_points: 0.25 },
      { question_id: 'a2222222-2222-2222-2222-222222222222', student_answer: 'A', is_correct: true, earned_points: 0.25, max_points: 0.25 },
      { question_id: 'a3333333-3333-3333-3333-333333333333', student_answer: ['A', 'B'], is_correct: false, earned_points: 0.5, max_points: 1.0 },
      { question_id: 'a4444444-4444-4444-4444-444444444444', student_answer: { a: true, b: true, c: true, d: false }, is_correct: false, earned_points: 0.25, max_points: 1.0 },
      { question_id: 'a5555555-5555-5555-5555-555555555555', student_answer: '6', is_correct: true, earned_points: 0.5, max_points: 0.5 },
      { question_id: 'a6666666-6666-6666-6666-666666666666', student_answer: '4', is_correct: true, earned_points: 0.5, max_points: 0.5 },
      { question_id: 'a7777777-7777-7777-7777-777777777777', student_answer: 'V = x^2 * h = 32 => h = 32 / x^2. S = x^2 + 4xh. Đạo hàm S\' = 2x - 128/x^2.', is_correct: undefined, earned_points: 0, max_points: 1.0 },
    ],
  },
];

export const MOCK_MATERIALS: Material[] = [
  {
    id: 'm1',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    class_id: 'c1111111-1111-1111-1111-111111111111',
    title: 'Tóm Tắt Công Thức Giải Nhanh Toán 12 Chuẩn 2025.pdf',
    type: 'pdf',
    file_url: 'https://raw.githubusercontent.com/math-resources/cheatsheet.pdf',
    file_size: 2450000,
    grade: 12,
    description: 'Sổ tay bỏ túi toàn bộ công thức Đạo hàm, Tích phân, Mũ - Logarit, Hình Oxyz.',
  },
  {
    id: 'm2',
    teacher_id: '22222222-2222-2222-2222-222222222222',
    class_id: 'c1111111-1111-1111-1111-111111111111',
    title: 'Video Bài Giảng: Phương Pháp Tọa Độ Hóa Hình Học Không Gian',
    type: 'video',
    file_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    grade: 12,
    description: 'Bí quyết gắn hệ trục Oxyz giải quyết mọi bài toán khoảng cách và góc thi tốt nghiệp.',
  },
];

