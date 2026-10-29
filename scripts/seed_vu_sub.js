const fs = require('fs');
const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v) env[k.trim()] = v.join('=').trim();
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function seedStudentVuSubmission() {
  const studentId = '33333333-3333-3333-3333-333333333333';
  await supabase.from('profiles').upsert([{
    id: studentId,
    email: 'an.toan12@gmail.com',
    full_name: 'Vũ',
    role: 'student',
    grade: 12,
    school_name: 'THPT Chuyên Lê Hồng Phong',
    updated_at: new Date().toISOString()
  }]);

  const examId = '11111111-2222-3333-4444-555555555555';
  const meta = {
    __lms_meta__: true,
    code: 'JUHTVU',
    assigned_classes: ['11 Anh 1'],
    format: 'standard_3_parts',
    submissions_count: 1,
    questions: [
      { id: 'q1', type: 'single_choice', content: 'Câu trắc nghiệm 1', points: 0.25 },
      { id: 'q-essay-1', type: 'essay', content: 'Tính giá trị cực trị của hàm số $y = x^3 - 3x^2 + 2$.', points: 1.5, correct_answer: 'Đạo hàm $y\' = 3x^2 - 6x = 0$. Cực đại tại $x=0$, cực tiểu tại $x=2$.' }
    ]
  };

  await supabase.from('exams').upsert([{
    id: examId,
    title: '11-1',
    description: JSON.stringify(meta),
    grade: 12,
    duration_minutes: 42,
    teacher_id: '11111111-1111-1111-1111-111111111111',
    status: 'published',
    passing_score: 5.0,
    shuffle_questions: true,
    shuffle_options: true,
    max_attempts: 3,
    updated_at: new Date().toISOString()
  }]);

  const feedbackObj = {
    __meta__: true,
    feedback: 'Bài thi có câu tự luận, đang chờ Thầy Sơn chấm điểm.',
    tab_switch_count: 0,
    answers: [
      { question_id: 'q1', student_answer: 'A', earned_points: 0.25, is_correct: true },
      { question_id: 'q-essay-1', student_answer: 'Ta có đạo hàm y\' = 3x^2 - 6x. Cho y\' = 0 ta được x = 0 hoặc x = 2.', earned_points: 0, max_points: 1.5 }
    ]
  };

  const subId = '99999999-9999-9999-9999-111111111111';
  const { data, error } = await supabase.from('submissions').upsert([{
    id: subId,
    exam_id: examId,
    student_id: studentId,
    start_time: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    submitted_at: new Date().toISOString(),
    score: 3.41,
    max_score: 10,
    status: 'grading',
    teacher_feedback: JSON.stringify(feedbackObj),
    updated_at: new Date().toISOString()
  }]).select().single();

  console.log('Result error:', error ? error.message : 'SUCCESS!');
  if (data) console.log('Created submission ID:', data.id, 'score:', data.score, 'status:', data.status);
}

seedStudentVuSubmission();
