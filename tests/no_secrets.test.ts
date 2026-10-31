import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('server-only', () => ({}));

const ROOTS = ['src', 'scripts', 'supabase', 'tests'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git']);
const PATTERNS: [string, RegExp][] = [
  ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]{20,}/],
  ['service_role JWT cứng', /SERVICE_ROLE[A-Z_]*\s*[=:]\s*['"]eyJ[A-Za-z0-9_-]{20,}/],
];

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs|json|sql|md|env.*)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('không có bí mật cứng trong mã nguồn', () => {
  it('quét src, scripts, supabase, tests', () => {
    const hits: string[] = [];
    for (const f of ROOTS.flatMap((r) => walk(r))) {
      const text = fs.readFileSync(f, 'utf8');
      for (const [name, re] of PATTERNS) if (re.test(text)) hits.push(`${f}: ${name}`);
    }
    expect(hits).toEqual([]);
  });
});

describe('adminClient', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  it('báo lỗi khi thiếu SUPABASE_SERVICE_ROLE_KEY, không dùng khóa mặc định', async () => {
    const saved = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321';
    const { getAdminClient } = await import('../src/lib/supabase/adminClient');
    expect(() => getAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    if (saved) process.env.SUPABASE_SERVICE_ROLE_KEY = saved;
  });
});
