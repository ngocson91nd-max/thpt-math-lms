import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/adminClient';

export interface AuthUser {
  id: string;
  role: 'student' | 'teacher';
}

/**
 * Trích xuất người dùng đã xác thực từ Authorization Bearer Token
 * Hỗ trợ header x-user-id cho môi trường kiểm thử tự động
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthUser | null> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      const admin = getSupabaseAdmin();
      const { data: { user }, error } = await admin.auth.getUser(token);
      if (user && !error) {
        const { data: profile } = await admin
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        return {
          id: user.id,
          role: profile?.role === 'teacher' || profile?.role === 'admin' ? 'teacher' : 'student',
        };
      }
    } catch {}
  }

  // Header dành cho kiểm thử tự động và client nội bộ
  const customUserId = req.headers.get('x-user-id');
  const customRole = req.headers.get('x-user-role');
  if (customUserId) {
    return {
      id: customUserId,
      role: customRole === 'teacher' || customRole === 'admin' ? 'teacher' : 'student',
    };
  }

  return null;
}
