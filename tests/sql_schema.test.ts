import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('SQL Schema & Security Migration Integrity Tests', () => {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261031000001_secure_questions_and_keys.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('migration file exists and contains private schema isolation', () => {
    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS private;');
    expect(sql).toContain('REVOKE ALL ON SCHEMA private FROM anon, authenticated;');
    expect(sql).toContain('ALTER DEFAULT PRIVILEGES IN SCHEMA private');
  });

  it('contains immutable question trigger on published status', () => {
    expect(sql).toContain('forbid_edit_published');
    expect(sql).toContain("OLD.status = 'published'");
    expect(sql).toContain('trg_qv_immutable');
  });

  it('contains check constraints preventing leakage of \\True, \\loigiai, \\choiceTF, \\shortans', () => {
    expect(sql).toContain('CONSTRAINT no_leak_content CHECK');
    expect(sql).toContain('CONSTRAINT no_leak_options CHECK');

    // Kiểm tra regex logic trong PostgreSQL
    const noLeakRegex = /\\(True|loigiai|choiceTF|shortans)/;
    expect(noLeakRegex.test('Đề bài: Cho tam giác ABC')).toBe(false);
    expect(noLeakRegex.test('Phương án A \\True')).toBe(true);
    expect(noLeakRegex.test('\\loigiai{Ta có AB = AC}')).toBe(true);
    expect(noLeakRegex.test('\\choiceTF{Đúng}{Sai}{Đúng}{Sai}')).toBe(true);
    expect(noLeakRegex.test('\\shortans{12}')).toBe(true);
  });

  it('verifies RLS policies: student cannot SELECT exam_questions or question_versions directly', () => {
    expect(sql).toContain('ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.question_versions ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;');

    // Không được có policy select cho student trên exam_questions
    expect(sql).not.toContain('CREATE POLICY eq_student_select');
    expect(sql).not.toContain('CREATE POLICY qv_student_select');

    // Quyền ghi bài nộp trực tiếp từ client bị thu hồi
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.submissions FROM anon, authenticated;');
  });
});
