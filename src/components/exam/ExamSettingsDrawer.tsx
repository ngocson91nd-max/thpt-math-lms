'use client';

import React, { useState } from 'react';
import { ClassItem } from '@/types/database';
import {
  X,
  Settings,
  Clock,
  Shuffle,
  ShieldAlert,
  Award,
  Users,
  Check,
  Sliders,
  FileText,
} from 'lucide-react';

export interface ExamSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  setTitle: (val: string) => void;
  grade: 10 | 11 | 12;
  setGrade: (val: 10 | 11 | 12) => void;
  duration: number;
  setDuration: (val: number) => void;
  noTimeLimit: boolean;
  setNoTimeLimit: (val: boolean) => void;
  code: string;
  setCode: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  partPoints: { part1: number; part2: number; part3: number; part4: number };
  setPartPoints: React.Dispatch<React.SetStateAction<{ part1: number; part2: number; part3: number; part4: number }>>;
  trueFalseScoring: 'standard_thpt' | 'equal';
  setTrueFalseScoring: (val: 'standard_thpt' | 'equal') => void;
  shuffleQuestions: boolean;
  setShuffleQuestions: (val: boolean) => void;
  shuffleOptions: boolean;
  setShuffleOptions: (val: boolean) => void;
  shuffleTrueFalse: boolean;
  setShuffleTrueFalse: (val: boolean) => void;
  maxAttempts: number;
  setMaxAttempts: (val: number) => void;
  submissionMinMinutes: number;
  setSubmissionMinMinutes: (val: number) => void;
  maxViolations: number;
  setMaxViolations: (val: number) => void;
  viewAnswerPolicy: 'immediately' | 'after_closed' | 'specific_time';
  setViewAnswerPolicy: (val: 'immediately' | 'after_closed' | 'specific_time') => void;
  assignedClasses: string[];
  setAssignedClasses: React.Dispatch<React.SetStateAction<string[]>>;
  classes: ClassItem[];
}

export default function ExamSettingsDrawer({
  isOpen,
  onClose,
  title,
  setTitle,
  grade,
  setGrade,
  duration,
  setDuration,
  noTimeLimit,
  setNoTimeLimit,
  code,
  setCode,
  description,
  setDescription,
  partPoints,
  setPartPoints,
  trueFalseScoring,
  setTrueFalseScoring,
  shuffleQuestions,
  setShuffleQuestions,
  shuffleOptions,
  setShuffleOptions,
  shuffleTrueFalse,
  setShuffleTrueFalse,
  maxAttempts,
  setMaxAttempts,
  submissionMinMinutes,
  setSubmissionMinMinutes,
  maxViolations,
  setMaxViolations,
  viewAnswerPolicy,
  setViewAnswerPolicy,
  assignedClasses,
  setAssignedClasses,
  classes,
}: ExamSettingsDrawerProps) {
  const [activeTab, setActiveTab] = useState<'scoring' | 'timing' | 'security' | 'classes'>('scoring');

  if (!isOpen) return null;

  const totalPoints = partPoints.part1 + partPoints.part2 + partPoints.part3 + partPoints.part4;

  const toggleClass = (clsName: string) => {
    setAssignedClasses((prev) =>
      prev.includes(clsName) ? prev.filter((c) => c !== clsName) : [...prev, clsName]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-250">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Settings className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Cài Đặt Đề Thi Nâng Cao</h3>
              <p className="text-[11px] text-slate-500">Ma trận điểm, thời gian & chống gian lận</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 p-1.5 bg-slate-100/70 text-xs font-bold text-slate-600 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('scoring')}
            className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
              activeTab === 'scoring' ? 'bg-white text-blue-700 shadow-2xs font-extrabold' : 'hover:text-slate-900'
            }`}
          >
            Điểm số
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timing')}
            className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
              activeTab === 'timing' ? 'bg-white text-blue-700 shadow-2xs font-extrabold' : 'hover:text-slate-900'
            }`}
          >
            Thời gian
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
              activeTab === 'security' ? 'bg-white text-blue-700 shadow-2xs font-extrabold' : 'hover:text-slate-900'
            }`}
          >
            Bảo mật
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('classes')}
            className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
              activeTab === 'classes' ? 'bg-white text-blue-700 shadow-2xs font-extrabold' : 'hover:text-slate-900'
            }`}
          >
            Giao lớp
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* TAB 1: ĐIỂM SỐ & CÁCH CHẤM */}
          {activeTab === 'scoring' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200 text-blue-900 flex items-center justify-between">
                <span className="font-bold">Tổng điểm đề thi:</span>
                <span className={`text-base font-extrabold ${totalPoints === 10 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {totalPoints.toFixed(1)} / 10.0 điểm
                </span>
              </div>

              <div className="space-y-3">
                <label className="font-extrabold text-slate-800 block">Ma trận điểm từng phần:</label>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-white">
                    <span className="text-[11px] font-bold text-slate-600 block mb-1">Phần I (Trắc nghiệm):</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.25"
                        value={partPoints.part1}
                        onChange={(e) => setPartPoints((p) => ({ ...p, part1: parseFloat(e.target.value) || 0 }))}
                        className="w-full rounded-lg border border-slate-200 p-1.5 text-xs font-bold text-slate-800"
                      />
                      <span className="text-slate-500 font-bold">điểm</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 bg-white">
                    <span className="text-[11px] font-bold text-slate-600 block mb-1">Phần II (Đúng / Sai):</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.25"
                        value={partPoints.part2}
                        onChange={(e) => setPartPoints((p) => ({ ...p, part2: parseFloat(e.target.value) || 0 }))}
                        className="w-full rounded-lg border border-slate-200 p-1.5 text-xs font-bold text-slate-800"
                      />
                      <span className="text-slate-500 font-bold">điểm</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 bg-white">
                    <span className="text-[11px] font-bold text-slate-600 block mb-1">Phần III (Điền số):</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.25"
                        value={partPoints.part3}
                        onChange={(e) => setPartPoints((p) => ({ ...p, part3: parseFloat(e.target.value) || 0 }))}
                        className="w-full rounded-lg border border-slate-200 p-1.5 text-xs font-bold text-slate-800"
                      />
                      <span className="text-slate-500 font-bold">điểm</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 bg-white">
                    <span className="text-[11px] font-bold text-slate-600 block mb-1">Phần IV (Tự luận):</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.25"
                        value={partPoints.part4}
                        onChange={(e) => setPartPoints((p) => ({ ...p, part4: parseFloat(e.target.value) || 0 }))}
                        className="w-full rounded-lg border border-slate-200 p-1.5 text-xs font-bold text-slate-800"
                      />
                      <span className="text-slate-500 font-bold">điểm</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="font-extrabold text-slate-800 block">Quy tắc chấm Phần II (Đúng/Sai):</label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="tf_rule"
                      checked={trueFalseScoring === 'standard_thpt'}
                      onChange={() => setTrueFalseScoring('standard_thpt')}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Chuẩn Bộ GD&ĐT (0.1 - 0.25 - 0.5 - 1.0)</span>
                      <span className="text-[11px] text-slate-500">Đúng 1 ý: 0.1đ; 2 ý: 0.25đ; 3 ý: 0.5đ; 4 ý: 1.0đ</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="tf_rule"
                      checked={trueFalseScoring === 'equal'}
                      onChange={() => setTrueFalseScoring('equal')}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">Chia đều điểm (0.25đ / ý)</span>
                      <span className="text-[11px] text-slate-500">Mỗi ý đúng được 25% số điểm của câu</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THỜI GIAN & CHÍNH SÁCH */}
          {activeTab === 'timing' && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2">
                <label className="font-bold text-slate-800 block">Thời gian làm bài:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    disabled={noTimeLimit}
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 45)}
                    className="w-24 rounded-lg border border-slate-200 p-2 text-xs font-bold text-slate-800 disabled:opacity-40"
                  />
                  <span className="text-slate-600 font-bold">phút</span>
                </div>

                <label className="flex items-center gap-2 mt-2 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={noTimeLimit}
                    onChange={(e) => setNoTimeLimit(e.target.checked)}
                    className="h-3.5 w-3.5 rounded text-blue-600"
                  />
                  <span>Không giới hạn thời gian làm bài (ôn tập tự do)</span>
                </label>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2">
                <label className="font-bold text-slate-800 block">Thời gian nộp bài tối thiểu:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max={duration}
                    value={submissionMinMinutes}
                    onChange={(e) => setSubmissionMinMinutes(parseInt(e.target.value) || 0)}
                    className="w-24 rounded-lg border border-slate-200 p-2 text-xs font-bold text-slate-800"
                  />
                  <span className="text-slate-600 font-bold">phút mới được bấm nộp</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2">
                <label className="font-bold text-slate-800 block">Chính sách xem đáp án sau khi nộp:</label>
                <select
                  value={viewAnswerPolicy}
                  onChange={(e) => setViewAnswerPolicy(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs font-bold text-slate-800 bg-white"
                >
                  <option value="immediately">Xem đáp án & lời giải ngay sau khi nộp</option>
                  <option value="after_closed">Chỉ xem sau khi đề thi đóng lại</option>
                  <option value="specific_time">Không cho phép học sinh xem đáp án</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 3: BẢO MẬT & TRỘN ĐỀ */}
          {activeTab === 'security' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2.5">
                <span className="font-bold text-slate-800 block">Tùy chọn xáo trộn đề:</span>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    className="h-3.5 w-3.5 rounded text-blue-600"
                  />
                  <span>Tự động trộn thứ tự câu hỏi cho từng học sinh</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={shuffleOptions}
                    onChange={(e) => setShuffleOptions(e.target.checked)}
                    className="h-3.5 w-3.5 rounded text-blue-600"
                  />
                  <span>Tự động xáo trộn các phương án A, B, C, D (Phần I)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={shuffleTrueFalse}
                    onChange={(e) => setShuffleTrueFalse(e.target.checked)}
                    className="h-3.5 w-3.5 rounded text-blue-600"
                  />
                  <span>Tự động xáo trộn các mệnh đề Đúng/Sai (Phần II)</span>
                </label>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block">Giám sát & Chống gian lận:</span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Số lần vi phạm thoát tab tối đa:</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={maxViolations}
                    onChange={(e) => setMaxViolations(parseInt(e.target.value) || 3)}
                    className="w-16 rounded-lg border border-slate-200 p-1.5 text-center font-bold"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Nếu học sinh chuyển tab hoặc mở ứng dụng khác quá số lần trên, bài thi sẽ tự động bị khóa và nộp bài.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block">Số lần làm bài tối đa:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 0)}
                    className="w-20 rounded-lg border border-slate-200 p-1.5 text-center font-bold"
                  />
                  <span className="text-slate-500">(0 = không giới hạn số lần làm lại)</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PHÂN LỚP HỌC SINH */}
          {activeTab === 'classes' && (
            <div className="space-y-3">
              <span className="font-bold text-slate-800 block">Chọn các lớp được phép vào thi:</span>
              {classes.length === 0 ? (
                <p className="text-slate-400 italic text-center py-4">Chưa có lớp học nào được tạo.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {classes.map((cls) => {
                    const isSelected = assignedClasses.includes(cls.name);
                    return (
                      <div
                        key={cls.id}
                        onClick={() => toggleClass(cls.name)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-400 text-blue-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <p className="text-xs">{cls.name}</p>
                          <p className="text-[11px] text-slate-400 font-normal">Mã lớp: {cls.code}</p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Cài đặt được lưu tự động</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 hover:bg-blue-500 transition cursor-pointer"
          >
            Áp dụng & Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
