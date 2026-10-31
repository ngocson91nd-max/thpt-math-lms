import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    // Tuyệt đối không có giá trị mặc định cho khóa bí mật
    throw new Error(`Thiếu biến môi trường bắt buộc: ${name}`);
  }
  return v;
}

let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cached;
}

// Giữ alias tương thích cho các route hiện có
export const getSupabaseAdmin = getAdminClient;
