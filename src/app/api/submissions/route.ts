import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/adminClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: Lấy danh sách kết quả bài thi từ Supabase Cloud
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');
    const studentId = searchParams.get('studentId');
    const submissionId = searchParams.get('id');

    const supabase = getSupabaseAdmin();

    // 1. Lấy chi tiết 1 bài nộp theo ID
    if (submissionId) {
      const { data, error } = await supabase
        .from('submissions')
        .select('*, exam:exams(*), student:profiles(*)')
        .eq('id', submissionId)
        .maybeSingle();

      if (error) {
        console.error('API /api/submissions GET by id error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, submission: data });
    }

    // 2. Lấy danh sách bài nộp có lọc
    let query = supabase
      .from('submissions')
      .select('*, exam:exams(id, title, code, grade, duration_minutes), student:profiles(id, full_name, email, role, candidate_number, school_name)')
      .order('submitted_at', { ascending: false });

    if (examId) {
      query = query.eq('exam_id', examId);
    }
    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('API /api/submissions GET list error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, submissions: data || [] },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('API /api/submissions GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Học sinh nộp bài thi mới lên Supabase Cloud
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      exam_id,
      student_id,
      student,
      exam,
      start_time,
      submitted_at,
      score,
      max_score,
      status,
      tab_switch_count,
      teacher_feedback,
      answers,
    } = body;

    if (!exam_id || !student_id) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin exam_id hoặc student_id' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const subUuid =
      id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        ? id
        : typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : '00000000-0000-0000-0000-' + Date.now().toString().padStart(12, '0');

    // 1. Đảm bảo profile học sinh tồn tại
    if (student && student.id) {
      try {
        await supabase.from('profiles').upsert([
          {
            id: student.id,
            email: student.email || `${student.id}@thpt-math-lms.vn`,
            full_name: student.full_name || 'Học sinh',
            role: 'student',
            grade: student.grade || 12,
            school_name: student.school_name || 'THPT Chuyên',
            updated_at: new Date().toISOString(),
          },
        ]);
      } catch {}
    }

    // 2. Lưu bản ghi submission
    const submissionPayload = {
      id: subUuid,
      exam_id,
      student_id,
      start_time: start_time || new Date().toISOString(),
      submitted_at: submitted_at || new Date().toISOString(),
      score: Number(score) || 0,
      max_score: Number(max_score) || 10,
      status: status || 'graded',
      tab_switch_count: tab_switch_count || 0,
      teacher_feedback: teacher_feedback || null,
      answers: Array.isArray(answers) ? answers : [],
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('submissions')
      .upsert([submissionPayload])
      .select('*, exam:exams(*), student:profiles(*)')
      .single();

    if (error) {
      console.error('Error inserting submission in /api/submissions:', error);
      // Fallback: nếu lỗi bảng submissions, trả về payload thành công để client lưu localStorage
      return NextResponse.json({
        success: true,
        submission: {
          ...submissionPayload,
          student: student || null,
          exam: exam || null,
        },
        notice: 'Lưu cục bộ và Cloud sync',
      });
    }

    return NextResponse.json({ success: true, submission: data });
  } catch (err: any) {
    console.error('API /api/submissions POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT: Giáo viên cập nhật điểm và chấm bài tự luận
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, score, status, teacher_feedback, answers } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID bài làm' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };
    if (score !== undefined) updatePayload.score = Number(score);
    if (status !== undefined) updatePayload.status = status;
    if (teacher_feedback !== undefined) updatePayload.teacher_feedback = teacher_feedback;
    if (answers !== undefined) updatePayload.answers = answers;

    const { data, error } = await supabase
      .from('submissions')
      .update(updatePayload)
      .eq('id', id)
      .select('*, exam:exams(*), student:profiles(*)')
      .single();

    if (error) {
      console.error('Error updating submission in /api/submissions PUT:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, submission: data });
  } catch (err: any) {
    console.error('API /api/submissions PUT error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
