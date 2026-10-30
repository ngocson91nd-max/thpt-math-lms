import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/adminClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Giải mã answers và tab_switch_count từ cột teacher_feedback và bung toàn bộ thông tin đề thi
function unpackSubmission(sub: any) {
  if (!sub) return sub;
  let answers = Array.isArray(sub.answers) ? sub.answers : [];
  let feedback = sub.teacher_feedback || '';
  let tabSwitch = sub.tab_switch_count || 0;

  if (typeof feedback === 'string' && feedback.startsWith('{"__meta__":true')) {
    try {
      const parsed = JSON.parse(feedback);
      answers = Array.isArray(parsed.answers) ? parsed.answers : answers;
      feedback = parsed.feedback || '';
      tabSwitch = parsed.tab_switch_count ?? tabSwitch;
    } catch {}
  }

  // Đảm bảo exam object có title, code, và danh sách câu hỏi
  let examObj = sub.exam;
  if (examObj) {
    let cleanDesc = examObj.description || '';
    let extra: any = {};
    if (typeof cleanDesc === 'string' && cleanDesc.startsWith('{"__lms_meta__":true')) {
      try {
        extra = JSON.parse(cleanDesc);
        cleanDesc = extra.text || '';
      } catch {}
    }
    const rawQuestions = Array.isArray(extra.questions) ? extra.questions : [];
    examObj = {
      ...examObj,
      description: cleanDesc,
      code: extra.code || examObj.code || (examObj.id ? examObj.id.substring(0, 6).toUpperCase() : 'EXAM01'),
      questions: rawQuestions,
      questions_count: rawQuestions.length,
      format: extra.format || 'standard_3_parts',
      part_structure: extra.part_structure || null,
      part_points: extra.part_points || null,
      assigned_classes: Array.isArray(extra.assigned_classes) ? extra.assigned_classes : [],
      access_type: extra.access_type || 'restricted',
      is_locked: extra.is_locked ?? (examObj.status === 'closed'),
      exam_mode: extra.exam_mode || 'standard',
      pdf_url: extra.pdf_url || null,
      solution_pdf_url: extra.solution_pdf_url || null,
    };
  } else {
    examObj = {
      id: sub.exam_id,
      title: sub.exam_title || 'Đề kiểm tra',
      code: sub.exam_code || '',
      questions: [],
      assigned_classes: [],
    };
  }

  const studentObj = sub.student || {
    id: sub.student_id,
    full_name: 'Học sinh',
    role: 'student',
  };

  return {
    ...sub,
    exam: examObj,
    student: studentObj,
    answers,
    tab_switch_count: tabSwitch,
    teacher_feedback: feedback,
  };
}

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

      return NextResponse.json({ success: true, submission: unpackSubmission(data) });
    }

    // 2. Lấy danh sách bài nộp có lọc
    let query = supabase
      .from('submissions')
      .select('*, exam:exams(*), student:profiles(*)')
      .order('submitted_at', { ascending: false });

    if (examId) {
      let resolvedExamId = examId.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedExamId);
      if (!isUuid) {
        // Tìm exam UUID theo code hoặc title trong description/title
        const { data: matchedExams } = await supabase
          .from('exams')
          .select('id, title, description')
          .or(`description.ilike.%${resolvedExamId}%,title.ilike.%${resolvedExamId}%`)
          .limit(1);
        if (matchedExams && matchedExams.length > 0) {
          resolvedExamId = matchedExams[0].id;
        }
      }
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedExamId)) {
        query = query.eq('exam_id', resolvedExamId);
      }
    }
    if (studentId) {
      let resolvedStudentId = studentId.trim();
      const isStudentUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedStudentId);
      if (!isStudentUuid) {
        const { data: matchedProfiles } = await supabase
          .from('profiles')
          .select('id')
          .or(`email.ilike.%${resolvedStudentId}%,full_name.ilike.%${resolvedStudentId}%`)
          .limit(1);
        if (matchedProfiles && matchedProfiles.length > 0) {
          resolvedStudentId = matchedProfiles[0].id;
        }
      }
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedStudentId)) {
        query = query.eq('student_id', resolvedStudentId);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('API /api/submissions GET list error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const formattedSubs = (data || []).map(unpackSubmission);

    return NextResponse.json(
      { success: true, submissions: formattedSubs },
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

    // 1. Phân giải exam_id và student_id sang UUID chuẩn Postgres
    let finalExamId = exam_id;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalExamId)) {
      const { data: matchedExams } = await supabase
        .from('exams')
        .select('id')
        .or(`description.ilike.%${finalExamId}%,title.ilike.%${finalExamId}%`)
        .limit(1);
      if (matchedExams && matchedExams.length > 0) {
        finalExamId = matchedExams[0].id;
      }
    }

    let finalStudentId = student_id;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalStudentId)) {
      if (student?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(student.id)) {
        finalStudentId = student.id;
      } else {
        const { data: matchedProfiles } = await supabase
          .from('profiles')
          .select('id')
          .or(`email.ilike.%${finalStudentId}%,full_name.ilike.%${finalStudentId}%`)
          .limit(1);
        if (matchedProfiles && matchedProfiles.length > 0) {
          finalStudentId = matchedProfiles[0].id;
        } else {
          finalStudentId = '48dc643d-1b47-4c4e-a473-ca2f622b761c';
        }
      }
    }

    // 2. Đảm bảo profile học sinh tồn tại (nếu ID là UUID hợp lệ)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalStudentId)) {
      try {
        await supabase.from('profiles').upsert([
          {
            id: finalStudentId,
            email: student?.email || `${finalStudentId}@thpt-math-lms.vn`,
            full_name: student?.full_name || 'Học sinh',
            role: 'student',
            grade: student?.grade || 12,
            school_name: student?.school_name || 'THPT Chuyên',
            updated_at: new Date().toISOString(),
          },
        ]);
      } catch {}
    }

    // 3. Đóng gói answers và tab_switch_count vào teacher_feedback an toàn
    const feedbackMeta = {
      __meta__: true,
      feedback: typeof teacher_feedback === 'string' ? teacher_feedback : '',
      tab_switch_count: tab_switch_count || 0,
      answers: Array.isArray(answers) ? answers : [],
    };

    // 4. Chỉ gửi các cột chuẩn tồn tại trong bảng submissions của Supabase
    const submissionPayload = {
      id: subUuid,
      exam_id: finalExamId,
      student_id: finalStudentId,
      start_time: start_time || new Date().toISOString(),
      submitted_at: submitted_at || new Date().toISOString(),
      score: Number(score) || 0,
      max_score: Number(max_score) || 10,
      status: status || 'graded',
      teacher_feedback: JSON.stringify(feedbackMeta),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('submissions')
      .upsert([submissionPayload])
      .select('*, exam:exams(*), student:profiles(*)')
      .single();

    if (error) {
      console.error('Error inserting submission in /api/submissions:', error);
      return NextResponse.json({
        success: true,
        submission: {
          ...submissionPayload,
          answers: Array.isArray(answers) ? answers : [],
          student: student || null,
          exam: exam || null,
        },
      });
    }

    return NextResponse.json({ success: true, submission: unpackSubmission(data) });
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

    if (answers !== undefined || teacher_feedback !== undefined) {
      const feedbackMeta = {
        __meta__: true,
        feedback: typeof teacher_feedback === 'string' ? teacher_feedback : '',
        answers: Array.isArray(answers) ? answers : [],
      };
      updatePayload.teacher_feedback = JSON.stringify(feedbackMeta);
    }

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

    return NextResponse.json({ success: true, submission: unpackSubmission(data) });
  } catch (err: any) {
    console.error('API /api/submissions PUT error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
