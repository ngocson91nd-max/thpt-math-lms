import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/adminClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Giải mã metadata đề thi từ cột description
function unpackExam(exam: any, includeQuestions = true) {
  let extra: any = {};
  let cleanDesc = exam.description || '';

  if (typeof cleanDesc === 'string' && cleanDesc.startsWith('{"__lms_meta__":true')) {
    try {
      extra = JSON.parse(cleanDesc);
      cleanDesc = extra.text || '';
    } catch {}
  }

  const rawQuestions = Array.isArray(extra.questions) ? extra.questions : [];

  return {
    ...exam,
    description: cleanDesc,
    code: extra.code || exam.code || (exam.id ? exam.id.substring(0, 6).toUpperCase() : 'EXAM01'),
    category: extra.category || (extra.no_time_limit ? 'practice' : 'exam'),
    questions_count: rawQuestions.length,
    questions: includeQuestions ? rawQuestions : [],
    format: extra.format || 'standard_3_parts',
    part_structure: extra.part_structure || null,
    assigned_classes: Array.isArray(extra.assigned_classes) ? extra.assigned_classes : [],
    access_type: extra.access_type || 'restricted',
    is_locked: extra.is_locked ?? (exam.status === 'closed'),
    exam_mode: extra.exam_mode || 'standard',
    pdf_url: extra.pdf_url || null,
    solution_pdf_url: extra.solution_pdf_url || null,
    pdf_total_pages: extra.pdf_total_pages || null,
    pdf_cut_last_page: extra.pdf_cut_last_page ?? false,
    part_points: extra.part_points || null,
    true_false_scoring: extra.true_false_scoring || null,
    submission_restriction: extra.submission_restriction || null,
    submission_min_minutes: extra.submission_min_minutes || null,
    violation_action: extra.violation_action || null,
    max_violations: extra.max_violations || null,
    view_answer_policy: extra.view_answer_policy || null,
    view_score_allowed: extra.view_score_allowed ?? true,
    view_leaderboard_allowed: extra.view_leaderboard_allowed ?? true,
    shuffle_true_false: extra.shuffle_true_false ?? true,
    no_time_limit: extra.no_time_limit ?? false,
  };
}

// GET: Lấy danh sách toàn bộ đề thi thời gian thực hoặc chi tiết 1 đề từ Supabase Cloud
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get('id');
    const isFull = searchParams.get('full') === 'true';

    const supabase = getSupabaseAdmin();

    // 1. Nếu lấy chi tiết 1 đề thi cụ thể: Luôn trả về đầy đủ toàn bộ câu hỏi (questions)
    if (targetId) {
      let data: any = null;
      let error: any = null;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(targetId)) {
        const res = await supabase
          .from('exams')
          .select('*')
          .eq('id', targetId)
          .maybeSingle();
        data = res.data;
        error = res.error;
      }

      // Nếu không tìm thấy theo UUID hoặc targetId là mã code / tiêu đề
      if (!data) {
        const { data: allExams } = await supabase.from('exams').select('*');
        if (allExams && allExams.length > 0) {
          const cleanTarget = targetId.trim().toLowerCase();
          data =
            allExams.find((e: any) => {
              if (e.id && e.id.toLowerCase() === cleanTarget) return true;
              if (e.title && e.title.trim().toLowerCase() === cleanTarget) return true;
              if (e.description && typeof e.description === 'string') {
                try {
                  const meta = JSON.parse(e.description);
                  if (meta.code && meta.code.toLowerCase() === cleanTarget) return true;
                } catch {}
              }
              return false;
            }) || (allExams.length === 1 ? allExams[0] : null);
        }
      }

      if (error) {
        console.error('API /api/exams GET by id error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy đề thi' }, { status: 404 });
      }

      let subCount = 0;
      let pendingCount = 0;
      let firstPendingId: string | null = null;
      try {
        const { data: subs } = await supabase
          .from('submissions')
          .select('id, status')
          .eq('exam_id', data.id)
          .order('submitted_at', { ascending: false });
        if (subs && Array.isArray(subs)) {
          subCount = subs.length;
          const pendingSubs = subs.filter((s: any) => s.status === 'grading' || s.status === 'pending');
          pendingCount = pendingSubs.length;
          firstPendingId = pendingSubs[0]?.id || null;
        }
      } catch {}

      const formattedExam = unpackExam(data, true);
      formattedExam.submissions_count = subCount;
      formattedExam.pending_grading_count = pendingCount;
      formattedExam.first_pending_submission_id = firstPendingId;

      return NextResponse.json(
        { success: true, exam: formattedExam },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        }
      );
    }

    // 2. Danh sách toàn bộ đề thi: Trả kèm đầy đủ câu hỏi để học sinh bấm vào làm bài là nạp tức thì 0ms!
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('API /api/exams GET error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Đếm số lượng bài nộp và bài chờ chấm tự luận cho từng đề thi từ Supabase Cloud
    const countMap: Record<string, number> = {};
    const pendingMap: Record<string, number> = {};
    const firstPendingMap: Record<string, string> = {};
    try {
      const { data: subsData } = await supabase
        .from('submissions')
        .select('id, exam_id, status')
        .order('submitted_at', { ascending: false });
      if (subsData && Array.isArray(subsData)) {
        subsData.forEach((s: any) => {
          if (s.exam_id) {
            countMap[s.exam_id] = (countMap[s.exam_id] || 0) + 1;
            if (s.status === 'grading' || s.status === 'pending') {
              pendingMap[s.exam_id] = (pendingMap[s.exam_id] || 0) + 1;
              if (!firstPendingMap[s.exam_id]) {
                firstPendingMap[s.exam_id] = s.id;
              }
            }
          }
        });
      }
    } catch {}

    const formattedExams = (data || []).map((exam) => {
      const unpacked = unpackExam(exam, true);
      unpacked.submissions_count = countMap[unpacked.id] || 0;
      unpacked.pending_grading_count = pendingMap[unpacked.id] || 0;
      unpacked.first_pending_submission_id = firstPendingMap[unpacked.id] || null;
      return unpacked;
    });

    return NextResponse.json(
      { success: true, exams: formattedExams },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('API /api/exams GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Tạo hoặc cập nhật đề thi trên Supabase Cloud
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      code,
      title,
      description,
      grade,
      duration_minutes,
      teacher_id,
      class_id,
      status,
      passing_score,
      shuffle_questions,
      shuffle_options,
      shuffle_true_false,
      max_attempts,
      start_time,
      end_time,
      is_view_answer_allowed,
      is_locked,
      questions,
      format,
      category,
      exam_mode,
      assigned_classes,
      access_type,
      no_time_limit,
      pdf_url,
      solution_pdf_url,
      pdf_total_pages,
      pdf_cut_last_page,
      part_structure,
      part_points,
      true_false_scoring,
      submission_restriction,
      submission_min_minutes,
      violation_action,
      max_violations,
      view_answer_policy,
      view_score_allowed,
      view_leaderboard_allowed,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: 'Tiêu đề đề thi là bắt buộc' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Chuẩn hóa UUID đề thi
    const examUuid =
      id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        ? id
        : typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : '00000000-0000-0000-0000-' + Date.now().toString().padStart(12, '0');

    // Đóng gói metadata để lưu vào description
    const metadata = {
      __lms_meta__: true,
      text: typeof description === 'string' ? description.trim() : 'Đề kiểm tra Toán THPT Thầy Sơn.',
      code: code || examUuid.substring(0, 6).toUpperCase(),
      questions: Array.isArray(questions) ? questions : [],
      format: format || 'standard_3_parts',
      category: category || (no_time_limit ? 'practice' : 'exam'),
      exam_mode: exam_mode || 'standard',
      assigned_classes: Array.isArray(assigned_classes) ? assigned_classes : [],
      access_type: access_type || 'restricted',
      is_locked: is_locked ?? (status === 'closed'),
      no_time_limit: no_time_limit ?? false,
      pdf_url: pdf_url || null,
      solution_pdf_url: solution_pdf_url || null,
      pdf_total_pages: pdf_total_pages || null,
      pdf_cut_last_page: pdf_cut_last_page ?? false,
      part_structure: part_structure || null,
      part_points: part_points || null,
      true_false_scoring: true_false_scoring || null,
      submission_restriction: submission_restriction || null,
      submission_min_minutes: submission_min_minutes || null,
      violation_action: violation_action || null,
      max_violations: max_violations || null,
      view_answer_policy: view_answer_policy || null,
      view_score_allowed: view_score_allowed ?? true,
      view_leaderboard_allowed: view_leaderboard_allowed ?? true,
      shuffle_true_false: shuffle_true_false ?? true,
    };

    const payload = {
      id: examUuid,
      title: title.trim(),
      description: JSON.stringify(metadata),
      grade: Number(grade) || 12,
      duration_minutes: Number(duration_minutes) || 45,
      teacher_id: teacher_id || '11111111-1111-1111-1111-111111111111',
      class_id: class_id || null,
      status: status || (is_locked ? 'closed' : 'published'),
      passing_score: passing_score || 5.0,
      shuffle_questions: shuffle_questions ?? true,
      shuffle_options: shuffle_options ?? true,
      max_attempts: max_attempts || 1,
      start_time: start_time || null,
      end_time: end_time || null,
      is_view_answer_allowed: is_view_answer_allowed ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('exams')
      .upsert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error upserting exam in /api/exams:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const formattedExam = unpackExam(data);

    return NextResponse.json({ success: true, exam: formattedExam });
  } catch (err: any) {
    console.error('API /api/exams POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Xóa đề thi (hoặc xóa tất cả) khỏi Supabase Cloud
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('id');
    const deleteAll = searchParams.get('all') === 'true';

    const supabase = getSupabaseAdmin();

    if (deleteAll) {
      try {
        await supabase.from('submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch {}

      const { error } = await supabase
        .from('exams')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'Đã xóa toàn bộ đề thi trên Cloud' });
    }

    if (!examId) {
      return NextResponse.json({ success: false, error: 'Thiếu ID đề thi cần xóa' }, { status: 400 });
    }

    try {
      await supabase.from('submissions').delete().eq('exam_id', examId);
    } catch {}

    const { error } = await supabase.from('exams').delete().eq('id', examId);

    if (error) {
      console.error('Error deleting exam:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa đề thi thành công' });
  } catch (err: any) {
    console.error('API /api/exams DELETE error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
