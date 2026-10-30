'use client';

import { createClient } from '@/lib/supabase/client';

export type SyncEventType =
  | 'EXAMS_UPDATED'
  | 'CLASSES_UPDATED'
  | 'ENROLLMENT_UPDATED'
  | 'SUBMISSIONS_UPDATED'
  | 'ALL_UPDATED';

let globalBroadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!globalBroadcastChannel && 'BroadcastChannel' in window) {
    try {
      globalBroadcastChannel = new BroadcastChannel('lms_realtime_sync');
    } catch {
      globalBroadcastChannel = null;
    }
  }
  return globalBroadcastChannel;
}

/**
 * Phát tín hiệu thay đổi dữ liệu thời gian thực tới toàn bộ các tab trình duyệt
 */
export function broadcastDataChange(type: SyncEventType, payload?: any) {
  if (typeof window === 'undefined') return;

  // 1. Gửi qua BroadcastChannel tới mọi tab khác trong trình duyệt (0ms)
  const bc = getBroadcastChannel();
  if (bc) {
    try {
      bc.postMessage({ type, payload, timestamp: Date.now() });
    } catch {}
  }

  // 2. Kích hoạt custom event trên tab hiện tại
  if (type === 'EXAMS_UPDATED' || type === 'ALL_UPDATED') {
    window.dispatchEvent(new CustomEvent('lms_exams_updated', { detail: payload }));
  }
  if (type === 'CLASSES_UPDATED' || type === 'ALL_UPDATED') {
    window.dispatchEvent(new CustomEvent('lms_classes_updated', { detail: payload }));
  }
  if (type === 'ENROLLMENT_UPDATED' || type === 'ALL_UPDATED') {
    window.dispatchEvent(new CustomEvent('lms_enrollment_changed', { detail: payload }));
  }
  if (type === 'SUBMISSIONS_UPDATED' || type === 'ALL_UPDATED') {
    window.dispatchEvent(new CustomEvent('lms_submissions_updated', { detail: payload }));
  }
}

/**
 * Khởi tạo bộ lắng nghe Realtime toàn cục (BroadcastChannel + Supabase WebSocket + Smart Polling)
 */
export function setupRealtimeSync(callbacks: {
  onExamsChange?: () => void;
  onClassesChange?: () => void;
  onEnrollmentChange?: () => void;
  onSubmissionsChange?: () => void;
}) {
  if (typeof window === 'undefined') return () => {};

  // 1. Lắng nghe BroadcastChannel (đa tab cùng máy 0ms)
  const bc = getBroadcastChannel();
  const handleBcMessage = (event: MessageEvent) => {
    const data = event.data;
    if (!data || !data.type) return;

    if (data.type === 'EXAMS_UPDATED' || data.type === 'ALL_UPDATED') {
      callbacks.onExamsChange?.();
    }
    if (data.type === 'CLASSES_UPDATED' || data.type === 'ALL_UPDATED') {
      callbacks.onClassesChange?.();
    }
    if (data.type === 'ENROLLMENT_UPDATED' || data.type === 'ALL_UPDATED') {
      callbacks.onEnrollmentChange?.();
    }
    if (data.type === 'SUBMISSIONS_UPDATED' || data.type === 'ALL_UPDATED') {
      callbacks.onSubmissionsChange?.();
    }
  };

  if (bc) {
    bc.addEventListener('message', handleBcMessage);
  }

  // 2. Lắng nghe Custom DOM Events
  const handleExamsDom = () => callbacks.onExamsChange?.();
  const handleClassesDom = () => callbacks.onClassesChange?.();
  const handleEnrollmentDom = () => callbacks.onEnrollmentChange?.();
  const handleSubmissionsDom = () => callbacks.onSubmissionsChange?.();

  window.addEventListener('lms_exams_updated', handleExamsDom);
  window.addEventListener('lms_classes_updated', handleClassesDom);
  window.addEventListener('lms_enrollment_changed', handleEnrollmentDom);
  window.addEventListener('lms_submissions_updated', handleSubmissionsDom);

  // 3. Kết nối Supabase Realtime WebSocket (đa thiết bị: Thầy duyệt trên máy tính -> điện thoại học sinh nhận ngay)
  let supabaseSub: any = null;
  const supabase = createClient();
  if (supabase) {
    try {
      supabaseSub = supabase
        .channel('public_realtime_lms')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'exams' },
          () => {
            callbacks.onExamsChange?.();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'classes' },
          () => {
            callbacks.onClassesChange?.();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'class_members' },
          () => {
            callbacks.onClassesChange?.();
            callbacks.onEnrollmentChange?.();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'submissions' },
          () => {
            callbacks.onSubmissionsChange?.();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Supabase Realtime not enabled or supported on this tier:', e);
    }
  }

  // 4. Cleanup function
  return () => {
    if (bc) {
      bc.removeEventListener('message', handleBcMessage);
    }
    window.removeEventListener('lms_exams_updated', handleExamsDom);
    window.removeEventListener('lms_classes_updated', handleClassesDom);
    window.removeEventListener('lms_enrollment_changed', handleEnrollmentDom);
    window.removeEventListener('lms_submissions_updated', handleSubmissionsDom);
    if (supabaseSub && supabase) {
      try {
        supabase.removeChannel(supabaseSub);
      } catch {}
    }
  };
}

/**
 * Tự động đồng bộ bài thi từ Sổ điểm chung (không tự ý re-POST lên Cloud)
 */
export function autoRecoverAllSubmissionsFromBrowser(): any[] {
  if (typeof window === 'undefined') return [];

  try {
    const rawAll = localStorage.getItem('lms_all_submissions');
    const allSubs: any[] = rawAll ? JSON.parse(rawAll) : [];
    return allSubs;
  } catch {
    return [];
  }
}

