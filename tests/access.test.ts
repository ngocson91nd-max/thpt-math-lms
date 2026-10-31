import { describe, it, expect } from 'vitest';
import { canViewSolutions } from '../src/lib/exam/access';

describe('canViewSolutions Access Control Truth Table Tests', () => {
  const teacherId = 'teacher-1';
  const otherTeacherId = 'teacher-2';
  const studentId = 'student-1';
  const otherStudentId = 'student-2';
  const examId = 'exam-101';
  const otherExamId = 'exam-999';

  const baseExam = {
    owner_id: teacherId,
    closes_at: new Date('2026-10-31T10:00:00Z'),
    solutions_published_at: null,
  };

  const nowDuringExam = new Date('2026-10-31T09:30:00Z');
  const nowAfterCloses = new Date('2026-10-31T10:05:00Z');

  it('Teacher: Owner can always view solutions, non-owner cannot', () => {
    // Chủ đề
    expect(
      canViewSolutions({
        role: 'teacher',
        userId: teacherId,
        exam: baseExam,
        examIdRequested: examId,
        now: nowDuringExam,
      })
    ).toBe(true);

    // Giáo viên khác
    expect(
      canViewSolutions({
        role: 'teacher',
        userId: otherTeacherId,
        exam: baseExam,
        examIdRequested: examId,
        now: nowDuringExam,
      })
    ).toBe(false);
  });

  it('Student: Denied if no submission or wrong student ID', () => {
    // Không có submission
    expect(
      canViewSolutions({
        role: 'student',
        userId: studentId,
        exam: baseExam,
        submission: undefined,
        examIdRequested: examId,
        now: nowAfterCloses,
      })
    ).toBe(false);

    // Submission của học sinh khác
    expect(
      canViewSolutions({
        role: 'student',
        userId: studentId,
        exam: baseExam,
        submission: {
          student_id: otherStudentId,
          status: 'submitted',
          exam_id: examId,
        },
        examIdRequested: examId,
        now: nowAfterCloses,
      })
    ).toBe(false);
  });

  it('Student: Denied if requesting solutions for a different exam (IDOR protection)', () => {
    // Học sinh nộp bài đề A nhưng dùng ID bài nộp để đòi xem đề B
    expect(
      canViewSolutions({
        role: 'student',
        userId: studentId,
        exam: baseExam,
        submission: {
          student_id: studentId,
          status: 'submitted',
          exam_id: otherExamId, // Nộp đề khác
        },
        examIdRequested: examId,
        now: nowAfterCloses,
      })
    ).toBe(false);
  });

  it('Student: Denied while status is in_progress, even if closes_at has passed', () => {
    // Đang làm bài thì không được xem đáp án
    expect(
      canViewSolutions({
        role: 'student',
        userId: studentId,
        exam: baseExam,
        submission: {
          student_id: studentId,
          status: 'in_progress',
          exam_id: examId,
        },
        examIdRequested: examId,
        now: nowAfterCloses,
      })
    ).toBe(false);
  });

  it('Student: Denied when submitted early but exam is still open for the class and not published', () => {
    // Nộp sớm (submitted), nhưng cả lớp vẫn đang thi (now <= closes_at) và GV chưa bấm công bố
    expect(
      canViewSolutions({
        role: 'student',
        userId: studentId,
        exam: baseExam,
        submission: {
          student_id: studentId,
          status: 'submitted',
          exam_id: examId,
        },
        examIdRequested: examId,
        now: nowDuringExam,
      })
    ).toBe(false);
  });

  it('Student: Allowed when exam closes_at has passed for the whole class', () => {
    // Hết giờ thi của cả lớp -> Được xem
    expect(
      canViewSolutions({
        role: 'student',
        userId: studentId,
        exam: baseExam,
        submission: {
          student_id: studentId,
          status: 'submitted',
          exam_id: examId,
        },
        examIdRequested: examId,
        now: nowAfterCloses,
      })
    ).toBe(true);
  });

  it('Student: Allowed when teacher explicitly published solutions early', () => {
    const publishedExam = {
      ...baseExam,
      solutions_published_at: new Date('2026-10-31T09:15:00Z'),
    };

    // Giáo viên đã bấm công bố lúc 9:15, lúc 9:30 HS đã nộp được xem
    expect(
      canViewSolutions({
        role: 'student',
        userId: studentId,
        exam: publishedExam,
        submission: {
          student_id: studentId,
          status: 'submitted',
          exam_id: examId,
        },
        examIdRequested: examId,
        now: nowDuringExam,
      })
    ).toBe(true);
  });

  it('Student: Denied if teacher scheduled solutions publication in the future', () => {
    const futurePublishExam = {
      ...baseExam,
      solutions_published_at: new Date('2026-10-31T11:00:00Z'), // Công bố lúc 11:00
    };

    expect(
      canViewSolutions({
        role: 'student',
        userId: studentId,
        exam: futurePublishExam,
        submission: {
          student_id: studentId,
          status: 'submitted',
          exam_id: examId,
        },
        examIdRequested: examId,
        now: nowDuringExam, // Đang là 9:30
      })
    ).toBe(false);
  });
});
