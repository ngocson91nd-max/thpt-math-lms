'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MOCK_CLASSES, MOCK_CLASS_MEMBERS, MOCK_EXAMS } from '@/lib/supabase/mockStore';
import { useAuth } from '@/context/AuthContext';
import { ClassMember, Exam, Profile, ClassItem } from '@/types/database';
import { approveStudentJoinRequest, rejectStudentJoinRequest } from '@/lib/auth/enrollment';
import { broadcastDataChange } from '@/lib/realtime/syncService';
import {
  GraduationCap,
  Users,
  Copy,
  Check,
  ClipboardList,
  Calendar,
  UserCheck,
  Play,
  ArrowLeft,
  Mail,
  Clock,
  Plus,
  Trash2,
  Pencil,
  Phone,
  School,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Hash,
  Sparkles,
  ArrowUpDown,
  FileSpreadsheet,
  Share2,
  Search,
  Award,
  RotateCcw,
  FileText,
  ExternalLink,
} from 'lucide-react';

function splitVietnameseName(fullName: string = '') {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || !fullName.trim()) {
    return { hoDem: '', ten: 'Học sinh' };
  }
  if (parts.length === 1) {
    return { hoDem: '', ten: parts[0] };
  }
  const ten = parts.pop() || '';
  const hoDem = parts.join(' ');
  return { hoDem, ten };
}

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { isTeacher } = useAuth();

  const router = useRouter();

  const rawId = resolvedParams.id;
  const decodedId = decodeURIComponent(rawId).trim();
  const normalizedId = decodedId.replace(/\s+/g, '-');

  // Kiểm tra xem lớp này đã bị xóa vĩnh viễn chưa
  let isClassDeleted = false;
  if (typeof window !== 'undefined') {
    const savedDeleted = localStorage.getItem('lms_deleted_class_ids');
    const deletedIds = new Set<string>(savedDeleted ? JSON.parse(savedDeleted) : []);
    if (deletedIds.has(rawId) || deletedIds.has(decodedId) || deletedIds.has(normalizedId)) {
      isClassDeleted = true;
    }
  }

  // Ưu tiên nạp lớp từ lms_classes của trình duyệt hoặc MOCK_CLASSES
  let initialClass: ClassItem | undefined;
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('lms_classes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        initialClass = parsed.find(
          (c: any) =>
            c.id === rawId ||
            c.id === decodedId ||
            c.id === normalizedId ||
            (c.code && c.code.toLowerCase() === rawId.toLowerCase()) ||
            (c.code && c.code.toLowerCase() === decodedId.toLowerCase())
        );
      } catch {}
    }
  }
  if (!initialClass) {
    initialClass = MOCK_CLASSES.find(
      (c) =>
        c.id === rawId ||
        c.id === decodedId ||
        c.id === normalizedId ||
        (c.code && c.code.toLowerCase() === rawId.toLowerCase()) ||
        (c.code && c.code.toLowerCase() === decodedId.toLowerCase())
    );
  }

  const [currentClass, setCurrentClass] = useState<ClassItem | undefined>(initialClass);
  const [isFetchingClass, setIsFetchingClass] = useState<boolean>(!initialClass && !isClassDeleted);
  const [activeTab, setActiveTab] = useState<'members' | 'exams' | 'pending'>('members');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!currentClass && !isClassDeleted) {
      fetch('/api/classes')
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.classes)) {
            const found = data.classes.find(
              (c: any) =>
                c.id === rawId ||
                c.id === decodedId ||
                c.id === normalizedId ||
                (c.code && c.code.toLowerCase() === rawId.toLowerCase()) ||
                (c.code && c.code.toLowerCase() === decodedId.toLowerCase())
            );
            if (found) {
              setCurrentClass(found);
              localStorage.setItem('lms_classes', JSON.stringify(data.classes));
            }
          }
        })
        .catch(() => {})
        .finally(() => setIsFetchingClass(false));
    }
  }, [currentClass, isClassDeleted, rawId, decodedId, normalizedId]);

  // Loading skeleton khi đang nạp lớp từ máy chủ
  if (isFetchingClass) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Đang tải thông tin lớp học...</p>
      </div>
    );
  }

  if (!currentClass || isClassDeleted) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Lớp học không tồn tại</h2>
        <p className="text-sm text-slate-500 max-w-md">
          Lớp học này đã bị xóa hoặc đường dẫn không chính xác. Thầy/học sinh vui lòng quay lại danh sách lớp học.
        </p>
        <Link
          href="/classes"
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Về danh sách lớp</span>
        </Link>
      </div>
    );
  }

  // Members state: nạp từ cache riêng của lớp, nếu chưa có thì lấy từ MOCK_CLASS_MEMBERS
  const [members, setMembers] = useState<ClassMember[]>(() => {
    if (typeof window !== 'undefined') {
      const savedMembers = localStorage.getItem(`lms_class_members_${currentClass.id}`);
      if (savedMembers) {
        try {
          const parsed = JSON.parse(savedMembers);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
    }
    return MOCK_CLASS_MEMBERS.filter((m) => m.class_id === currentClass.id);
  });

  // Pending students state
  const [pendingStudents, setPendingStudents] = useState<any[]>([]);

  const loadPendingStudents = () => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`lms_class_pending_requests_${currentClass.id}`);
        let list: any[] = raw ? JSON.parse(raw) : [];
        setPendingStudents(list);

        // Đồng bộ thời gian thực từ Cloud API
        fetch(`/api/cloud-sync?classId=${currentClass.id}&t=${Date.now()}`, { cache: 'no-store' })
          .then((r) => r.json())
          .then((res) => {
            if (res.success && Array.isArray(res.pending)) {
              setPendingStudents(res.pending);
              localStorage.setItem(
                `lms_class_pending_requests_${currentClass.id}`,
                JSON.stringify(res.pending)
              );
            }
            if (res.success && Array.isArray(res.members)) {
              setMembers(res.members);
              localStorage.setItem(
                `lms_class_members_${currentClass.id}`,
                JSON.stringify(res.members)
              );
            }
          })
          .catch(() => {});
      } catch {
        setPendingStudents([]);
      }
    }
  };

  // Exams state
  const [classExams, setClassExams] = useState<Exam[]>([]);

  // Modal States
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<ClassMember | null>(null);

  // Modal Giao đề thi có sẵn cho lớp này
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [allAvailableExams, setAllAvailableExams] = useState<Exam[]>([]);
  const [selectedExamIdsToAssign, setSelectedExamIdsToAssign] = useState<string[]>([]);
  const [assignToast, setAssignToast] = useState<string | null>(null);

  // Add Member Form
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentCandidateNumber, setNewStudentCandidateNumber] = useState('');
  const [newStudentSchool, setNewStudentSchool] = useState('THPT Chuyên Lê Hồng Phong');
  const [newStudentPhone, setNewStudentPhone] = useState('');

  // Edit Member Form
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentEmail, setEditStudentEmail] = useState('');
  const [editStudentCandidateNumber, setEditStudentCandidateNumber] = useState('');
  const [editStudentSchool, setEditStudentSchool] = useState('');
  const [editStudentPhone, setEditStudentPhone] = useState('');

  // Auto Assign SBD Modal
  const [showAutoAssignModal, setShowAutoAssignModal] = useState(false);
  const [autoAssignPrefix, setAutoAssignPrefix] = useState(String(currentClass.grade || '12'));

  // Tìm kiếm học sinh trong lớp (chuẩn ảnh 1)
  const [studentSearch, setStudentSearch] = useState('');

  // Modal Link phụ huynh
  const [showParentLinkModal, setShowParentLinkModal] = useState(false);
  const [parentLinkCopied, setParentLinkCopied] = useState(false);

  // Thùng rác: Danh sách học sinh đã xóa khỏi lớp
  const [deletedMembers, setDeletedMembers] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`lms_class_deleted_members_${currentClass.id}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showDeletedMembersModal, setShowDeletedMembersModal] = useState(false);

  // Sửa nhanh SBD trực tiếp tại dòng
  const [quickEditSbdId, setQuickEditSbdId] = useState<string | null>(null);
  const [quickEditSbdVal, setQuickEditSbdVal] = useState('');

  // Load from localStorage on mount
  useEffect(() => {
    if (isClassDeleted) {
      alert('Lớp học này đã bị xóa khỏi hệ thống!');
      router.push('/classes');
      return;
    }

    if (typeof window !== 'undefined') {
      const savedMembers = localStorage.getItem(`lms_class_members_${currentClass.id}`);
      if (savedMembers) {
        try {
          const parsed = JSON.parse(savedMembers);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMembers(parsed);
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        // Khởi tạo danh sách học sinh mặc định nếu chưa lưu trước đó
        const defaultMems = MOCK_CLASS_MEMBERS.filter((m) => m.class_id === currentClass.id);
        if (defaultMems.length > 0) {
          setMembers(defaultMems);
          localStorage.setItem(`lms_class_members_${currentClass.id}`, JSON.stringify(defaultMems));
        }
      }

      // Tải danh sách đề thi gán cho lớp này
      const savedDeleted = localStorage.getItem('lms_deleted_exam_ids');
      const deletedIds = new Set<string>(savedDeleted ? JSON.parse(savedDeleted) : []);
      const savedExams = localStorage.getItem('lms_exams');
      let allExams: Exam[] = [];
      if (savedExams) {
        try {
          allExams = JSON.parse(savedExams);
        } catch {}
      }
      if (!allExams.length) {
        allExams = [];
      }
      allExams = allExams.filter((e) => !deletedIds.has(e.id) && !deletedIds.has(e.code || ''));

      const relevant = allExams.filter((e) => {
        const inAssigned = e.assigned_classes?.some(
          (c) =>
            c.toLowerCase() === currentClass.name.toLowerCase() ||
            c.toLowerCase() === (currentClass.code || '').toLowerCase()
        );
        const inClassId = e.class_id === currentClass.id;
        const inClassName = e.class_name?.toLowerCase() === currentClass.name.toLowerCase();
        return inAssigned || inClassId || inClassName;
      });
      setClassExams(relevant);
    }
    loadPendingStudents();
    window.addEventListener('lms_enrollment_changed', loadPendingStudents);
    return () => window.removeEventListener('lms_enrollment_changed', loadPendingStudents);
  }, [currentClass.id, currentClass.name, currentClass.code, isClassDeleted, router]);

  const saveMembersToStorage = (updated: ClassMember[], skipEnrollmentBroadcast = false) => {
    setMembers(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`lms_class_members_${currentClass.id}`, JSON.stringify(updated));

      // Tự động đồng bộ số lượng học sinh thực tế vào danh sách lớp lms_classes
      try {
        const savedClasses = localStorage.getItem('lms_classes');
        if (savedClasses) {
          const parsed = JSON.parse(savedClasses);
          const idx = parsed.findIndex((c: any) => c.id === currentClass.id);
          if (idx >= 0) {
            parsed[idx].member_count = updated.length;
            localStorage.setItem('lms_classes', JSON.stringify(parsed));
          }
        }
      } catch (e) {
        console.error(e);
      }
      window.dispatchEvent(new Event('lms_classes_updated'));
      broadcastDataChange('CLASSES_UPDATED');
      if (!skipEnrollmentBroadcast) {
        broadcastDataChange('ENROLLMENT_UPDATED');
      }
    }
  };

  const handleApproveStudent = (req: any) => {
    const studentProfile: Profile = req.user || {
      id: req.user_id,
      email: req.email || 'student@thpt-math-lms.vn',
      full_name: req.full_name || 'Học sinh',
      role: 'student',
      grade: currentClass.grade,
      school_name: req.school_name || 'THPT Chuyên',
    };
    approveStudentJoinRequest(currentClass.id, studentProfile);

    // Đồng bộ lên Cloud API để bên màn hình học sinh nhận được lệnh phê duyệt
    fetch('/api/cloud-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve_student',
        classId: currentClass.id,
        className: currentClass.name,
        classCode: currentClass.code,
        student: studentProfile,
        userId: studentProfile.id,
      }),
    }).catch(console.error);

    const updated = [
      ...members,
      {
        id: `cm-${Date.now()}`,
        class_id: currentClass.id,
        user_id: studentProfile.id,
        role: 'student' as const,
        status: 'active' as const,
        joined_at: new Date().toISOString(),
        profile: studentProfile,
      },
    ];
    saveMembersToStorage(updated);
    setPendingStudents((prev) => prev.filter((p) => p.user_id !== studentProfile.id && p.id !== req.id));
  };

  const handleRejectStudent = async (userId: string) => {
    rejectStudentJoinRequest(currentClass.id, userId);

    setPendingStudents((prev) => prev.filter((p) => p.user_id !== userId));

    // Đồng bộ lên Cloud API
    try {
      await fetch('/api/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject_student',
          classId: currentClass.id,
          userId,
        }),
      });
    } catch (err) {
      console.error(err);
    }

    broadcastDataChange('ENROLLMENT_UPDATED');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(currentClass.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Mở modal giao đề có sẵn cho lớp
  const handleOpenAssignModal = () => {
    if (typeof window !== 'undefined') {
      const savedDeleted = localStorage.getItem('lms_deleted_exam_ids');
      const deletedIds = new Set<string>(savedDeleted ? JSON.parse(savedDeleted) : []);
      const savedExams = localStorage.getItem('lms_exams');
      let list: Exam[] = savedExams ? JSON.parse(savedExams) : MOCK_EXAMS;
      list = list.filter((e) => !deletedIds.has(e.id) && !deletedIds.has(e.code || ''));
      setAllAvailableExams(list);

      // Khởi tạo các đề đã gán cho lớp này
      const currentAssignedIds = list
        .filter((e) => {
          const inAssigned = e.assigned_classes?.some(
            (c) => c.trim().toLowerCase() === currentClass.name.trim().toLowerCase()
          );
          return inAssigned || e.class_id === currentClass.id;
        })
        .map((e) => e.id);
      setSelectedExamIdsToAssign(currentAssignedIds);
      setShowAssignModal(true);
    }
  };

  // Lưu phân công các đề thi cho lớp này
  const handleSaveClassExamsAssignment = () => {
    if (typeof window !== 'undefined') {
      const savedExams = localStorage.getItem('lms_exams');
      let list: Exam[] = savedExams ? JSON.parse(savedExams) : MOCK_EXAMS;
      const targetClassName = currentClass.name.trim();

      const updatedList = list.map((e) => {
        const isSelected = selectedExamIdsToAssign.includes(e.id);
        let assigned = Array.isArray(e.assigned_classes) ? [...e.assigned_classes] : [];
        const alreadyHas = assigned.some(
          (c) => c.trim().toLowerCase() === targetClassName.toLowerCase()
        );

        if (isSelected) {
          if (!alreadyHas) {
            assigned.push(targetClassName);
          }
          return {
            ...e,
            assigned_classes: assigned,
            access_type: 'restricted' as const,
            updated_at: new Date().toISOString(),
          };
        } else {
          if (alreadyHas) {
            assigned = assigned.filter(
              (c) => c.trim().toLowerCase() !== targetClassName.toLowerCase()
            );
          }
          return {
            ...e,
            assigned_classes: assigned,
            updated_at: new Date().toISOString(),
          };
        }
      });

      localStorage.setItem('lms_exams', JSON.stringify(updatedList));

      // Đồng bộ các đề thi đã thay đổi lớp lên Cloud API
      updatedList.forEach((e) => {
        fetch('/api/exams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(e),
        }).catch(() => {});
      });

      // Cập nhật lại classExams hiện tại
      const relevant = updatedList.filter((e) => {
        const inAssigned = e.assigned_classes?.some(
          (c) => c.trim().toLowerCase() === targetClassName.toLowerCase()
        );
        return inAssigned || e.class_id === currentClass.id;
      });
      setClassExams(relevant);
      setShowAssignModal(false);
      setAssignToast(`Đã cập nhật bài thi gán cho lớp ${currentClass.name} thành công!`);
      setTimeout(() => setAssignToast(null), 3000);
    }
  };

  // Bỏ giao một đề thi khỏi lớp
  const handleUnassignExam = (examId: string) => {
    if (typeof window !== 'undefined') {
      const savedExams = localStorage.getItem('lms_exams');
      let list: Exam[] = savedExams ? JSON.parse(savedExams) : MOCK_EXAMS;
      const targetClassName = currentClass.name.trim();

      const updatedList = list.map((e) => {
        if (e.id === examId) {
          const assigned = (e.assigned_classes || []).filter(
            (c) => c.trim().toLowerCase() !== targetClassName.toLowerCase()
          );
          return { ...e, assigned_classes: assigned, updated_at: new Date().toISOString() };
        }
        return e;
      });

      localStorage.setItem('lms_exams', JSON.stringify(updatedList));

      const unassignedExam = updatedList.find((e) => e.id === examId);
      if (unassignedExam) {
        fetch('/api/exams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(unassignedExam),
        }).catch(() => {});
      }

      setClassExams((prev) => prev.filter((e) => e.id !== examId));
      setAssignToast(`Đã gỡ đề khỏi lớp ${currentClass.name}!`);
      setTimeout(() => setAssignToast(null), 3000);
    }
  };

  // Thêm học sinh vào lớp
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentEmail.trim()) return;

    const cleanEm = newStudentEmail.trim().toLowerCase();
    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `cm-${Date.now()}`;

    const studentUserId = `stu-${Date.now()}`;

    const cleanCandidate = newStudentCandidateNumber.trim();
    const newMember: ClassMember = {
      id: newId,
      class_id: currentClass.id,
      user_id: studentUserId,
      candidate_number: cleanCandidate || undefined,
      role: 'student',
      status: 'active',
      joined_at: new Date().toISOString(),
      profile: {
        id: studentUserId,
        email: cleanEm,
        candidate_number: cleanCandidate || undefined,
        full_name: newStudentName.trim(),
        role: 'student',
        grade: currentClass.grade,
        school_name: newStudentSchool.trim() || 'THPT Chuyên Lê Hồng Phong',
        phone: newStudentPhone.trim(),
      },
    };

    const updated = [newMember, ...members];
    saveMembersToStorage(updated);

    // Lưu quyền lớp học cho học sinh theo cả user_id và email
    if (typeof window !== 'undefined') {
      const emailClassesKey = `lms_student_classes_${cleanEm}`;
      try {
        const enr: string[] = JSON.parse(localStorage.getItem(emailClassesKey) || '[]');
        if (!enr.includes(currentClass.id)) {
          enr.push(currentClass.id);
          localStorage.setItem(emailClassesKey, JSON.stringify(enr));
        }
      } catch {}
    }

    // Đồng bộ lập tức lên Supabase Cloud API
    fetch('/api/cloud-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve_student',
        classId: currentClass.id,
        student: newMember.profile,
        userId: studentUserId,
      }),
    }).catch(console.error);

    setShowAddMemberModal(false);
    setNewStudentName('');
    setNewStudentEmail('');
    setNewStudentCandidateNumber('');
    setNewStudentPhone('');
  };

  // Mở modal sửa học sinh
  const openEditMemberModal = (m: ClassMember) => {
    setEditingMember(m);
    setEditStudentName(m.profile?.full_name || '');
    setEditStudentEmail(m.profile?.email || '');
    setEditStudentCandidateNumber(m.candidate_number || m.profile?.candidate_number || '');
    setEditStudentSchool(m.profile?.school_name || '');
    setEditStudentPhone(m.profile?.phone || '');
    setShowEditMemberModal(true);
  };

  // Cập nhật thông tin học sinh
  const handleUpdateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editStudentName.trim()) return;

    const cleanCandidate = editStudentCandidateNumber.trim();
    const updated = members.map((m) => {
      if (m.id === editingMember.id) {
        return {
          ...m,
          candidate_number: cleanCandidate || undefined,
          profile: {
            ...m.profile,
            id: m.profile?.id || m.user_id,
            email: editStudentEmail.trim().toLowerCase() || m.profile?.email || '',
            candidate_number: cleanCandidate || undefined,
            full_name: editStudentName.trim(),
            role: 'student' as const,
            grade: currentClass.grade,
            school_name: editStudentSchool.trim() || 'THPT Chuyên Lê Hồng Phong',
            phone: editStudentPhone.trim(),
          },
        };
      }
      return m;
    });

    saveMembersToStorage(updated);
    setShowEditMemberModal(false);
    setEditingMember(null);
  };

  // Tự động đánh số báo danh A-Z cho cả lớp
  const handleAutoAssignSBD = (prefix: string) => {
    const cleanPrefix = (prefix || String(currentClass.grade || '12')).trim();

    // Sắp xếp học sinh theo Tên Tiếng Việt A-Z (tách tên từ chuỗi Họ và Tên)
    const sorted = [...members].sort((a, b) => {
      const getLastName = (fullName?: string) => {
        if (!fullName) return '';
        const parts = fullName.trim().split(/\s+/);
        return parts[parts.length - 1] || '';
      };
      const nameA = getLastName(a.profile?.full_name);
      const nameB = getLastName(b.profile?.full_name);
      const cmp = nameA.localeCompare(nameB, 'vi');
      if (cmp !== 0) return cmp;
      return (a.profile?.full_name || '').localeCompare(b.profile?.full_name || '', 'vi');
    });

    const updated = sorted.map((m, idx) => {
      const sbd = `${cleanPrefix}${String(idx + 1).padStart(3, '0')}`;
      return {
        ...m,
        candidate_number: sbd,
        profile: {
          ...m.profile,
          id: m.profile?.id || m.user_id,
          email: m.profile?.email || '',
          candidate_number: sbd,
          full_name: m.profile?.full_name || '',
          role: 'student' as const,
        },
      };
    });

    saveMembersToStorage(updated);

    // Đồng bộ lên Cloud API
    fetch('/api/cloud-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'auto_assign_sbd',
        classId: currentClass.id,
        members: updated.map((m) => ({ user_id: m.user_id, candidate_number: m.candidate_number })),
      }),
    }).catch(console.error);

    setShowAutoAssignModal(false);
    setAssignToast(`Đã tự động đánh số báo danh cho ${updated.length} học sinh thành công!`);
    setTimeout(() => setAssignToast(null), 3000);
  };

  // Xóa học sinh khỏi lớp & đưa vào Thùng rác "Học sinh đã xóa" (chuẩn ảnh 1 của iExam)
  const handleDeleteMember = async (memberId: string, studentName: string) => {
    const isConfirmed = confirm(
      `Thầy có chắc chắn muốn xóa học sinh "${studentName}" ra khỏi lớp này không? Học sinh sẽ được chuyển vào mục "Học sinh đã xóa" để Thầy có thể khôi phục lại khi cần.`
    );
    if (!isConfirmed) return;

    const targetMember = members.find((m) => m.id === memberId);
    const updated = members.filter((m) => m.id !== memberId);
    // Lưu local và hoãn phát ENROLLMENT_UPDATED cho tới khi Cloud đã xóa xong
    saveMembersToStorage(updated, true);

    if (targetMember) {
      const updatedDeleted = [
        { ...targetMember, deleted_at: new Date().toISOString() },
        ...deletedMembers.filter((dm) => dm.id !== memberId),
      ];
      setDeletedMembers(updatedDeleted);
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          `lms_class_deleted_members_${currentClass.id}`,
          JSON.stringify(updatedDeleted)
        );

        // Xóa sạch quyền lớp học của học sinh này trong cache trình duyệt nếu có
        if (targetMember.user_id) {
          const uKey = `lms_student_classes_${targetMember.user_id}`;
          const currentU: string[] = JSON.parse(localStorage.getItem(uKey) || '[]');
          localStorage.setItem(uKey, JSON.stringify(currentU.filter((id) => id !== currentClass.id && id !== currentClass.code)));
        }
        if (targetMember.profile?.email) {
          const emKey = `lms_student_classes_${targetMember.profile.email.toLowerCase()}`;
          const currentEm: string[] = JSON.parse(localStorage.getItem(emKey) || '[]');
          localStorage.setItem(emKey, JSON.stringify(currentEm.filter((id) => id !== currentClass.id && id !== currentClass.code)));
        }
      }

      // ĐỢI CLOUD XÓA TRIỆT ĐỂ KHỎI SUPABASE XONG XUÔI
      try {
        await fetch('/api/cloud-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'remove_student',
            classId: currentClass.id,
            userId: targetMember.user_id,
            student: targetMember.profile,
          }),
        });
      } catch (err) {
        console.error('Lỗi khi xóa học sinh trên Cloud:', err);
      }

      // Sau khi Supabase đã xóa sạch mới thông báo realtime tới các tab/máy khác
      broadcastDataChange('ENROLLMENT_UPDATED');
    }
  };

  // Khôi phục học sinh từ thùng rác
  const handleRestoreMember = (delMember: any) => {
    const { deleted_at, ...restored } = delMember;
    const updatedMembers = [...members, restored];
    saveMembersToStorage(updatedMembers);

    const updatedDeleted = deletedMembers.filter((dm) => dm.id !== delMember.id);
    setDeletedMembers(updatedDeleted);
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        `lms_class_deleted_members_${currentClass.id}`,
        JSON.stringify(updatedDeleted)
      );
    }

    // Cập nhật lại Cloud
    fetch('/api/cloud-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve_student',
        classId: currentClass.id,
        className: currentClass.name,
        classCode: currentClass.code,
        student: restored.profile || restored,
        userId: restored.user_id,
      }),
    }).catch(console.error);

    setAssignToast(`Đã khôi phục học sinh "${restored.profile?.full_name || 'Học sinh'}" trở lại lớp!`);
    setTimeout(() => setAssignToast(null), 3000);
  };

  // Xuất file Excel danh sách học sinh (chuẩn iExam Ảnh 1)
  const handleExportExcel = () => {
    const bom = '\uFEFF';
    let csv = `${bom}STT,Số Báo Danh,Họ và đệm,Tên,Họ và tên đầy đủ,Email / Tên đăng nhập,Số điện thoại,Trường THPT,Ngày tham gia\n`;
    members.forEach((m, idx) => {
      const full = m.profile?.full_name || 'Học sinh';
      const { hoDem, ten } = splitVietnameseName(full);
      const sbd = m.candidate_number || m.profile?.candidate_number || '';
      const email = m.profile?.email || '';
      const phone = m.profile?.phone || '';
      const school = m.profile?.school_name || 'THPT Chuyên Lê Hồng Phong';
      const joined = m.joined_at ? new Date(m.joined_at).toLocaleDateString('vi-VN') : '';
      csv += `${idx + 1},"${sbd}","${hoDem}","${ten}","${full}","${email}","${phone}","${school}","${joined}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Danh_sach_lop_${currentClass.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setAssignToast('Đã xuất file Excel danh sách học sinh thành công!');
    setTimeout(() => setAssignToast(null), 3000);
  };

  // Sửa nhanh SBD trực tiếp tại ô
  const handleSaveQuickSbd = (memberId: string) => {
    const cleanSbd = quickEditSbdVal.trim();
    const updated = members.map((m) => {
      if (m.id === memberId) {
        return {
          ...m,
          candidate_number: cleanSbd,
          profile: {
            ...m.profile,
            id: m.profile?.id || m.user_id,
            email: m.profile?.email || '',
            full_name: m.profile?.full_name || '',
            role: 'student' as const,
            candidate_number: cleanSbd,
          },
        };
      }
      return m;
    });
    saveMembersToStorage(updated);
    setQuickEditSbdId(null);
    setAssignToast('Đã cập nhật Số Báo Danh thành công!');
    setTimeout(() => setAssignToast(null), 2500);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Back button */}
      <Link
        href="/classes"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại danh sách lớp
      </Link>

      {/* Class Banner */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                Toán Lớp {currentClass.grade}
              </span>
              <span className="text-xs text-slate-400">Năm học {currentClass.academic_year || '2025-2026'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {currentClass.name}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {currentClass.description || 'Lớp bồi dưỡng và luyện thi THPT Thầy Sơn.'}
            </p>
          </div>

          {/* Class Code */}
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase">Mã tham gia:</div>
              <div className="font-mono text-base font-black text-slate-900">{currentClass.code}</div>
            </div>
            <button
              onClick={copyCode}
              className="rounded-xl bg-white p-2 text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-2xs"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Tab Switcher & Actions */}
        <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-px">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('members')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                activeTab === 'members'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Danh Sách Học Sinh</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                {members.length}
              </span>
            </button>

            {isTeacher && (
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                  activeTab === 'pending'
                    ? 'border-amber-600 text-amber-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Clock className="h-4 w-4" />
                <span>Chờ Duyệt Vào Lớp</span>
                {pendingStudents.length > 0 && (
                  <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-black animate-pulse">
                    {pendingStudents.length}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab('exams')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                activeTab === 'exams'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              <span>Bài Kiểm Tra Lớp</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                {classExams.length}
              </span>
            </button>
          </div>

          {isTeacher && activeTab === 'members' && (
            <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-0">
              <button
                type="button"
                onClick={() => {
                  setAutoAssignPrefix(String(currentClass.grade || '12'));
                  setShowAutoAssignModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer shadow-2xs"
                title="Tự động sắp xếp A-Z theo tên và gán số báo danh"
              >
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                <span>Đánh SBD Tự Động</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500 transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm Học Sinh Vào Lớp</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab: Pending Students List */}
      {activeTab === 'pending' && (
        <div className="overflow-hidden rounded-3xl border border-amber-200/80 bg-white shadow-xs">
          <div className="bg-amber-50/70 px-6 py-3 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <Clock className="h-4 w-4 text-amber-600" />
              <span>Danh Sách Học Sinh Vừa Đăng Ký Chờ Thầy Duyệt Vào Lớp ({pendingStudents.length})</span>
            </div>
            <span className="text-[11px] text-amber-700">Mã lớp để học sinh tự vào: <strong className="font-mono">{currentClass.code}</strong></span>
          </div>

          {pendingStudents.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <div className="font-bold text-slate-700">Hiện tại không có học sinh nào đang chờ duyệt.</div>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Khi học sinh tạo tài khoản và bấm &quot;Xin vào lớp&quot;, yêu cầu sẽ lập tức xuất hiện tại đây để Thầy phê duyệt chỉ với 1 click.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-6">Học Sinh</th>
                  <th className="py-3.5 px-6">Email & SĐT</th>
                  <th className="py-3.5 px-6">Trường THPT</th>
                  <th className="py-3.5 px-6">Thời Gian Gửi</th>
                  <th className="py-3.5 px-6 text-right">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingStudents.map((p) => {
                  const student = p.user || {};
                  return (
                    <tr key={p.id} className="hover:bg-amber-50/30 transition">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-700">
                            {student.full_name?.charAt(0) || 'H'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{student.full_name || 'Học sinh'}</div>
                            <div className="text-[11px] text-slate-400">Khối Lớp {student.grade || currentClass.grade}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        <div className="font-medium text-slate-800">{student.email || 'Chưa có email'}</div>
                        <div className="text-[11px] text-slate-400">{student.phone || 'Chưa cập nhật SĐT'}</div>
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        {student.school_name || 'THPT Chuyên Lê Hồng Phong'}
                      </td>
                      <td className="py-4 px-6 text-slate-500 text-[11px]">
                        {p.requested_at ? new Date(p.requested_at).toLocaleDateString('vi-VN') : 'Vừa gửi'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleApproveStudent(p)}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 font-bold text-white shadow-xs hover:bg-emerald-500 transition cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Duyệt vào lớp</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectStudent(p.user_id)}
                            className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Xóa yêu cầu"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Members List (Thiết kế chuẩn iExam Ảnh 1) */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* Header Thông Tin Lớp & Hàng Nút Tác Vụ Chuẩn iExam */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Danh sách học sinh</h2>
              <div className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-700">Lớp {currentClass.name}</span>
                <span>•</span>
                <span className="font-bold text-slate-800">{members.length} học sinh</span>
                <span>•</span>
                <span className="font-bold text-blue-700">
                  {members.filter((m) => Boolean(m.candidate_number || m.profile?.candidate_number)).length}/{members.length} có số báo danh
                </span>
              </div>
            </div>

            {isTeacher && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Nút Học sinh đã xóa (Thùng rác) */}
                <button
                  type="button"
                  onClick={() => setShowDeletedMembersModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                  <span>Học sinh đã xoá ({deletedMembers.length})</span>
                </button>

                {/* Nút Bảng điểm cả lớp */}
                <Link
                  href={`/gradebook?class=${encodeURIComponent(currentClass.name)}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500 transition cursor-pointer"
                >
                  <Award className="h-3.5 w-3.5" />
                  <span>Bảng điểm cả lớp</span>
                </Link>

                {/* Nút Link phụ huynh */}
                <button
                  type="button"
                  onClick={() => setShowParentLinkModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                >
                  <Share2 className="h-3.5 w-3.5 text-slate-500" />
                  <span>Link phụ huynh</span>
                </button>

                {/* Nút Gán số báo danh */}
                <button
                  type="button"
                  onClick={() => {
                    setAutoAssignPrefix(String(currentClass.grade || '12'));
                    setShowAutoAssignModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                >
                  <Hash className="h-3.5 w-3.5 text-slate-500" />
                  <span>Gán số báo danh</span>
                </button>

                {/* Nút Xuất Excel */}
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Xuất Excel</span>
                </button>

                {/* Nút Thêm Học Sinh Vào Lớp */}
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm học sinh</span>
                </button>
              </div>
            )}
          </div>

          {/* Ô Tìm kiếm học sinh */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Tìm theo tên, email hoặc SBD..."
              className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-2xs transition"
            />
          </div>

          {/* Bảng Danh Sách Học Sinh */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
            {members.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Chưa có học sinh nào trong lớp. Thầy có thể bấm &quot;Thêm học sinh&quot; hoặc gửi mã vào lớp cho học sinh.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-3.5 px-6 w-36">SBD</th>
                    <th className="py-3.5 px-6">Họ và đệm</th>
                    <th className="py-3.5 px-6 font-black text-slate-800">Tên</th>
                    <th className="py-3.5 px-6">Email / SĐT</th>
                    <th className="py-3.5 px-6">Ngày tham gia</th>
                    {isTeacher && <th className="py-3.5 px-6 text-right">THAO TÁC</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members
                    .filter((m) => {
                      if (!studentSearch.trim()) return true;
                      const q = studentSearch.trim().toLowerCase();
                      const full = (m.profile?.full_name || '').toLowerCase();
                      const email = (m.profile?.email || '').toLowerCase();
                      const phone = (m.profile?.phone || '').toLowerCase();
                      const sbd = (m.candidate_number || m.profile?.candidate_number || '').toLowerCase();
                      return full.includes(q) || email.includes(q) || phone.includes(q) || sbd.includes(q);
                    })
                    .map((m) => {
                      const full = m.profile?.full_name || 'Học sinh';
                      const { hoDem, ten } = splitVietnameseName(full);
                      const sbd = m.candidate_number || m.profile?.candidate_number;
                      const joinedDate = m.joined_at ? new Date(m.joined_at) : null;
                      const joinedFormatted = joinedDate
                        ? `${joinedDate.toLocaleTimeString('vi-VN')} ${joinedDate.toLocaleDateString('vi-VN')}`
                        : 'Mới vào lớp';

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition group">
                          {/* SBD */}
                          <td className="py-4 px-6">
                            {quickEditSbdId === m.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={quickEditSbdVal}
                                  onChange={(e) => setQuickEditSbdVal(e.target.value)}
                                  autoFocus
                                  placeholder="SBD..."
                                  className="w-20 font-mono font-bold text-xs p-1 rounded-md border border-blue-500 text-blue-700 outline-none"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveQuickSbd(m.id);
                                    if (e.key === 'Escape') setQuickEditSbdId(null);
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveQuickSbd(m.id)}
                                  className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500 cursor-pointer"
                                  title="Lưu SBD"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                              </div>
                            ) : sbd ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickEditSbdId(m.id);
                                  setQuickEditSbdVal(sbd);
                                }}
                                className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
                                title="Bấm để sửa số báo danh"
                              >
                                {sbd}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickEditSbdId(m.id);
                                  setQuickEditSbdVal('');
                                }}
                                className="text-amber-600 font-semibold italic hover:underline cursor-pointer"
                                title="Bấm để gán số báo danh"
                              >
                                chưa có
                              </button>
                            )}
                          </td>

                          {/* Họ và đệm */}
                          <td className="py-4 px-6 text-slate-700 font-medium">
                            {hoDem || '—'}
                          </td>

                          {/* Tên */}
                          <td className="py-4 px-6 font-bold text-slate-900 text-sm">
                            {ten}
                          </td>

                          {/* Email & SĐT */}
                          <td className="py-4 px-6 text-slate-600">
                            <div className="font-medium text-slate-800">{m.profile?.email || 'Chưa có email'}</div>
                            {m.profile?.phone && (
                              <div className="text-[11px] text-slate-400 font-mono">{m.profile.phone}</div>
                            )}
                          </td>

                          {/* Ngày tham gia */}
                          <td className="py-4 px-6 text-slate-500 text-[11px] font-mono">
                            {joinedFormatted}
                          </td>

                          {/* Thao tác */}
                          {isTeacher && (
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Link
                                  href={`/gradebook?student=${encodeURIComponent(m.user_id)}&class=${encodeURIComponent(currentClass.name)}`}
                                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs"
                                  title="Xem kết quả bài thi của học sinh"
                                >
                                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                                  <span>Bài thi</span>
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMember(m.id, full)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 transition shadow-2xs cursor-pointer"
                                  title="Xóa học sinh khỏi lớp"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Xóa</span>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Exams */}
      {activeTab === 'exams' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Danh sách các bài thi và đề kiểm tra dành riêng cho lớp <span className="font-bold text-slate-700">{currentClass.name}</span>.
            </p>
            {isTeacher && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenAssignModal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 shadow-2xs transition cursor-pointer"
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>+ Giao đề có sẵn cho lớp</span>
                </button>
                <Link
                  href={`/exams?class=${encodeURIComponent(currentClass.name)}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                >
                  <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
                  <span>Xem trên trang Đề thi</span>
                </Link>
                <Link
                  href={`/exams/editor?new=1&class=${encodeURIComponent(currentClass.name)}`}
                  prefetch={true}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500 shadow-2xs transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tạo đề mới cho lớp</span>
                </Link>
              </div>
            )}
          </div>

          {classExams.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">Chưa có bài kiểm tra nào gán cho lớp này</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Thầy có thể bấm "Giao đề có sẵn cho lớp" để chọn đề thi hoặc tạo đề mới riêng cho lớp {currentClass.name}.
              </p>
              {isTeacher && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenAssignModal}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition shadow-2xs cursor-pointer"
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span>Giao đề có sẵn cho lớp ngay</span>
                  </button>
                  <Link
                    href={`/exams/editor?new=1&class=${encodeURIComponent(currentClass.name)}`}
                    prefetch={true}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tạo đề thi mới ngay</span>
                  </Link>
                  <Link
                    href="/exams"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <span>Ngân hàng đề thi →</span>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classExams.map((e) => {
                const isLocked = e.is_locked || e.status === 'closed';
                return (
                  <div
                    key={e.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-blue-200 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                          {e.code || e.id.slice(0, 6).toUpperCase()}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isLocked ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                              Đã khóa
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              Đang mở
                            </span>
                          )}
                          {e.exam_mode === 'pdf_view' && (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-md">
                              PDF
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2">{e.title}</h3>

                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {e.duration_minutes} phút
                        </span>
                        <span>•</span>
                        <span>{e.questions?.length || 22} câu hỏi</span>
                        <span>•</span>
                        <span>{e.submissions_count || 0} bài nộp</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {isTeacher ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/exams/results/${e.id}`}
                              className="inline-flex items-center gap-1 rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                            >
                              <span>Xem điểm</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleUnassignExam(e.id)}
                              className="inline-flex items-center gap-1 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 px-2 py-1.5 text-xs font-medium transition cursor-pointer"
                              title="Bỏ giao bài thi này khỏi lớp"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Gỡ khỏi lớp</span>
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/exams/editor?id=${e.id}`}
                              prefetch={true}
                              className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Sửa đề</span>
                            </Link>
                            <Link
                              href={`/exams/${e.id}/take`}
                              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition shadow-xs"
                            >
                              <Play className="h-3 w-3" />
                              <span>Thi thử</span>
                            </Link>
                          </div>
                        </>
                      ) : (
                        <Link
                          href={`/exams/${e.id}/take`}
                          className="w-full flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500 transition"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>Vào làm bài</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Thêm Học Sinh Vào Lớp */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Thêm Học Sinh Vào Lớp</h2>
            <p className="mt-1 text-xs text-slate-500">
              Thêm học sinh trực tiếp vào {currentClass.name}.
            </p>

            <form onSubmit={handleAddMember} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên học sinh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email hoặc Tên đăng nhập học sinh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  placeholder="nguyenvanan@gmail.com hoặc vanan12"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số Báo Danh (SBD - Tùy chọn)
                </label>
                <input
                  type="text"
                  value={newStudentCandidateNumber}
                  onChange={(e) => setNewStudentCandidateNumber(e.target.value)}
                  placeholder="VD: 12001"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-blue-700 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Trường THPT</label>
                  <input
                    type="text"
                    value={newStudentSchool}
                    onChange={(e) => setNewStudentSchool(e.target.value)}
                    placeholder="THPT Chuyên Lê Hồng Phong"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={newStudentPhone}
                    onChange={(e) => setNewStudentPhone(e.target.value)}
                    placeholder="0912345678"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm"
                >
                  Thêm Học Sinh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh Sửa Học Sinh */}
      {showEditMemberModal && editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-slate-900">Chỉnh Sửa Thông Tin Học Sinh</h2>
            <p className="mt-1 text-xs text-slate-500">
              Cập nhật thông tin học sinh trong {currentClass.name}.
            </p>

            <form onSubmit={handleUpdateMember} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên học sinh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email / Tên đăng nhập <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editStudentEmail}
                  onChange={(e) => setEditStudentEmail(e.target.value)}
                  placeholder="nguyenvanan@gmail.com"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số Báo Danh (SBD)
                </label>
                <input
                  type="text"
                  value={editStudentCandidateNumber}
                  onChange={(e) => setEditStudentCandidateNumber(e.target.value)}
                  placeholder="VD: 12001"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-blue-700 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Trường THPT</label>
                  <input
                    type="text"
                    value={editStudentSchool}
                    onChange={(e) => setEditStudentSchool(e.target.value)}
                    placeholder="THPT Chuyên"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={editStudentPhone}
                    onChange={(e) => setEditStudentPhone(e.target.value)}
                    placeholder="0912345678"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditMemberModal(false);
                    setEditingMember(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm cursor-pointer"
                >
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tự Động Đánh Số Báo Danh (SBD) A-Z */}
      {showAutoAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Đánh Số Báo Danh Tự Động</h2>
                <p className="text-xs text-slate-500">Sắp xếp học sinh theo Tên A-Z và tạo SBD chuẩn</p>
              </div>
            </div>

            <div className="rounded-2xl bg-blue-50/70 border border-blue-200 p-4 text-xs text-blue-800 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span>Quy tắc đánh số:</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>Sắp xếp toàn bộ {members.length} học sinh theo thứ tự <strong>Tên tiếng Việt (A &rarr; Z)</strong>.</li>
                <li>Gán số báo danh bắt đầu từ: <strong className="text-blue-700 font-mono">{autoAssignPrefix}001</strong>, <strong className="text-blue-700 font-mono">{autoAssignPrefix}002</strong>,...</li>
                <li>Học sinh sẽ thấy SBD này trên phiếu làm bài và bảng điểm thi.</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tiền tố Số Báo Danh (Mã khối/lớp):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={autoAssignPrefix}
                  onChange={(e) => setAutoAssignPrefix(e.target.value.trim().toUpperCase())}
                  placeholder="VD: 12 hoặc TOAN12"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Ví dụ mẫu: {autoAssignPrefix}001, {autoAssignPrefix}002, {autoAssignPrefix}003...
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAutoAssignModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleAutoAssignSBD(autoAssignPrefix)}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-500 transition shadow-md shadow-blue-600/20 cursor-pointer"
              >
                Tiến Hành Đánh SBD
              </button>
            </div>
          </div>
        </div>
      )}
      {/* TOAST THÔNG BÁO */}
      {assignToast && (
        <div className="fixed top-20 right-6 z-50 rounded-2xl bg-slate-900 text-white px-5 py-3 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{assignToast}</span>
        </div>
      )}

      {/* MODAL GIAO ĐỀ CÓ SẴN CHO LỚP NÀY */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Giao đề thi cho lớp {currentClass.name}</h3>
                  <p className="text-[11px] text-slate-500">Tick chọn các bài thi mà học sinh lớp này được phép làm</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">
                  Danh sách đề thi ({selectedExamIdsToAssign.length}/{allAvailableExams.length} đã chọn):
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSelectedExamIdsToAssign(allAvailableExams.map((e) => e.id))}
                    className="text-blue-600 hover:underline font-bold cursor-pointer"
                  >
                    Chọn hết
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedExamIdsToAssign([])}
                    className="text-slate-500 hover:underline font-medium cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              {allAvailableExams.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                  Chưa có đề thi nào trong hệ thống. Thầy có thể tạo đề mới từ trang Đề thi.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {allAvailableExams.map((exam) => {
                    const isSelected = selectedExamIdsToAssign.includes(exam.id);
                    return (
                      <label
                        key={exam.id}
                        className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition text-xs ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/50 shadow-2xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              setSelectedExamIdsToAssign(selectedExamIdsToAssign.filter((id) => id !== exam.id));
                            } else {
                              setSelectedExamIdsToAssign([...selectedExamIdsToAssign, exam.id]);
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                              {exam.code || exam.id.slice(0, 6).toUpperCase()}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Khối {exam.grade || 12} • {exam.duration_minutes} phút
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 truncate">{exam.title}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveClassExamsAssignment}
                className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-500 shadow-md shadow-blue-500/20 transition cursor-pointer"
              >
                Lưu phân công
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LINK PHỤ HUYNH (Chuẩn iExam Ảnh 1) */}
      {showParentLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Share2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Link Tra Cứu Dành Cho Phụ Huynh</h3>
                  <p className="text-[11px] text-slate-500">Lớp {currentClass.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowParentLinkModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Thầy chỉ cần gửi đường link duy nhất này vào nhóm Zalo phụ huynh. Bố mẹ học sinh có thể vào tra cứu điểm thi, bài chưa làm và nhận xét của Thầy:
            </p>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-blue-700 truncate select-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/classes/${currentClass.id}?role=parent` : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    const link = `${window.location.origin}/classes/${currentClass.id}?role=parent`;
                    navigator.clipboard.writeText(link);
                    setParentLinkCopied(true);
                    setTimeout(() => setParentLinkCopied(false), 2000);
                  }
                }}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition cursor-pointer"
              >
                {parentLinkCopied ? 'Đã sao chép!' : 'Sao chép link'}
              </button>
            </div>

            <div className="rounded-2xl bg-amber-50 p-3.5 border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span>💡 Hướng dẫn phụ huynh:</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Phụ huynh tra cứu bằng <strong>Số báo danh (SBD)</strong> hoặc <strong>Số điện thoại</strong> của học sinh.
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setShowParentLinkModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HỌC SINH ĐÃ XÓA (Thùng rác chuẩn iExam Ảnh 1) */}
      {showDeletedMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Học Sinh Đã Xóa Khỏi Lớp ({deletedMembers.length})</h3>
                  <p className="text-[11px] text-slate-500">Lớp {currentClass.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeletedMembersModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Danh sách học sinh Thầy đã xóa khỏi lớp này. Thầy có thể khôi phục lại bất cứ lúc nào mà không làm mất điểm bài thi cũ của em.
            </p>

            {deletedMembers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                Chưa có học sinh nào bị xóa khỏi lớp này.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl">
                {deletedMembers.map((dm) => (
                  <div key={dm.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50 transition">
                    <div>
                      <div className="font-bold text-slate-900">{dm.profile?.full_name || 'Học sinh'}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {dm.profile?.email || dm.profile?.phone || 'Chưa có thông tin liên hệ'}
                      </div>
                      {dm.deleted_at && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Đã xóa lúc: {new Date(dm.deleted_at).toLocaleString('vi-VN')}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestoreMember(dm)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold hover:bg-emerald-100 transition shadow-2xs cursor-pointer"
                    >
                      Khôi phục
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setShowDeletedMembersModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
