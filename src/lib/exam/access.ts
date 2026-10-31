/**
 * Hàm kiểm tra quyền xem lời giải & đáp án (Access Control Pure Function)
 * Đảm bảo không học sinh nào có thể xem đáp án trước khi:
 * 1. Đã nộp bài (không còn ở trạng thái in_progress)
 * 2. Đề thi đã đóng hoàn toàn đối với CẢ LỚP (now > closes_at) HOẶC giáo viên đã bấm công bố (solutions_published_at <= now)
 * 3. Chống tấn công IDOR: Thí sinh phải nộp bài cho đúng mã đề thi được yêu cầu
 */
export function canViewSolutions(c: {
  role: 'teacher' | 'student';
  userId: string;
  exam: { owner_id: string; closes_at: Date; solutions_published_at: Date | null };
  submission?: { student_id: string; status: 'in_progress' | 'submitted' | 'graded'; exam_id: string };
  examIdRequested: string;
  now: Date;
}): boolean {
  // Giáo viên chủ đề luôn có quyền xem
  if (c.role === 'teacher') {
    return c.exam.owner_id === c.userId;
  }

  // Học sinh: Bắt buộc phải có bài nộp hợp lệ
  const s = c.submission;
  if (!s || s.student_id !== c.userId) return false;

  // Chống IDOR: Bài nộp phải thuộc đúng đề thi đang yêu cầu xem đáp án
  if (s.exam_id !== c.examIdRequested) return false;

  // Nếu bài thi còn đang làm (in_progress), tuyệt đối không mở khóa
  if (s.status === 'in_progress') return false;

  // Điều kiện mở đáp án: Hết giờ thi của cả lớp HOẶC giáo viên đã bấm công bố
  const published = !!c.exam.solutions_published_at && c.exam.solutions_published_at <= c.now;
  const closed = c.now > c.exam.closes_at;

  return published || closed;
}
