'use client';

import React, { useState } from 'react';
import MathRenderer from '@/components/math/MathRenderer';
import MathEditor from '@/components/math/MathEditor';
import {
  Sparkles,
  BrainCircuit,
  HelpCircle,
  Lightbulb,
  Send,
  Plus,
  CheckCircle,
  Cpu,
  Layers,
} from 'lucide-react';

export default function AiAssistantPage() {
  const [activeTab, setActiveTab] = useState<'explain' | 'generate'>('explain');

  // Explain mode state
  const [mathInput, setMathInput] = useState(
    'Tìm giá trị lớn nhất của hàm số $f(x) = x^3 - 3x + 2$ trên đoạn $[0; 2]$.'
  );
  const [explanationResult, setExplanationResult] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  // Generate mode state
  const [genGrade, setGenGrade] = useState<10 | 11 | 12>(12);
  const [genTopic, setGenTopic] = useState('Khảo sát hàm số');
  const [genDifficulty, setGenDifficulty] = useState('thong_hieu');
  const [genType, setGenType] = useState('single_choice');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestion, setGeneratedQuestion] = useState<any | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleExplain = async () => {
    if (!mathInput.trim()) return;
    setIsExplaining(true);
    setExplanationResult(null);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'explain_solution',
          questionContent: mathInput,
        }),
      });

      const data = await res.json();
      if (data.success && data.result) {
        setExplanationResult(data.result);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsExplaining(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedQuestion(null);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_question',
          grade: genGrade,
          topic: genTopic,
          difficulty: genDifficulty,
          type: genType,
        }),
      });

      const data = await res.json();
      if (data.success && data.result) {
        try {
          const parsed = JSON.parse(data.result);
          setGeneratedQuestion(parsed);
        } catch {
          setGeneratedQuestion({
            content: data.result,
            explanation: 'Đã sinh bởi AI.',
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            Trợ Lý Trí Tuệ Nhân Tạo (Math AI Engine)
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            AI Trợ Lý Sư Phạm Toán THPT
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Hỗ trợ giải toán từng bước, giải thích bản chất sư phạm và sinh đề thi tự động theo ma trận Bộ GD&ĐT 2025.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
          <Cpu className="h-4 w-4 text-indigo-600" />
          <span>Server-side AI • Sẵn sàng offline</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('explain')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition ${
            activeTab === 'explain'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Lightbulb className="h-4 w-4" />
          Giải Thích Bài Toán Từng Bước
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('generate')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition ${
            activeTab === 'generate'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <BrainCircuit className="h-4 w-4" />
          Tạo Câu Hỏi Toán Theo Ma Trận
        </button>
      </div>

      {/* Mode 1: Explain Math Problem */}
      {activeTab === 'explain' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-4">
            <MathEditor
              value={mathInput}
              onChange={setMathInput}
              label="Nhập bài toán bạn muốn AI hướng dẫn giải:"
              placeholder="Nhập đề bài toán có chứa công thức LaTeX như $y = f(x)$, $\int$, $\lim$..."
              rows={4}
            />

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={isExplaining}
                onClick={handleExplain}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 transition disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {isExplaining ? 'AI Đang Giải Toán...' : 'Yêu Cầu AI Hướng Dẫn Từng Bước'}
              </button>
            </div>
          </div>

          {/* Result Card */}
          {explanationResult && (
            <div className="rounded-3xl border border-indigo-200 bg-white p-6 sm:p-8 shadow-sm animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm mb-4 border-b border-indigo-100 pb-3">
                <BrainCircuit className="h-5 w-5 text-indigo-600" />
                Lời Giải & Phân Tích Sư Phạm Của AI Trợ Lý Toán:
              </div>

              <div className="prose max-w-none text-slate-800 text-sm leading-relaxed">
                <MathRenderer content={explanationResult} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Generate Questions by Matrix */}
      {activeTab === 'generate' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp</label>
                <select
                  value={genGrade}
                  onChange={(e) => setGenGrade(Number(e.target.value) as any)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                >
                  <option value={12}>Lớp 12</option>
                  <option value={11}>Lớp 11</option>
                  <option value={10}>Lớp 10</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Chủ đề kiến thức</label>
                <select
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                >
                  <option value="Khảo sát hàm số">Khảo sát & Đồ thị hàm số</option>
                  <option value="Nguyên hàm - Tích phân">Nguyên hàm & Tích phân</option>
                  <option value="Hình học không gian Oxyz">Hình không gian Oxyz</option>
                  <option value="Mũ và Logarit">Hàm số Mũ & Logarit</option>
                  <option value="Xác suất và Thống kê">Xác suất & Thống kê 2025</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mức độ nhận thức</label>
                <select
                  value={genDifficulty}
                  onChange={(e) => setGenDifficulty(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                >
                  <option value="nhan_biet">Nhận biết</option>
                  <option value="thong_hieu">Thông hiểu</option>
                  <option value="van_dung">Vận dụng</option>
                  <option value="van_dung_cao">Vận dụng cao</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Định dạng câu hỏi</label>
                <select
                  value={genType}
                  onChange={(e) => setGenType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none"
                >
                  <option value="single_choice">Trắc nghiệm 1 đáp án</option>
                  <option value="true_false">Đúng / Sai 4 ý chuẩn THPT</option>
                  <option value="short_answer">Điền đáp số ngắn</option>
                  <option value="essay">Tự luận ứng dụng thực tế</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerate}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {isGenerating ? 'AI Đang Soạn Câu Hỏi...' : 'Bắt Đầu Sinh Câu Hỏi'}
              </button>
            </div>
          </div>

          {/* Generated Question Preview Card */}
          {generatedQuestion && (
            <div className="rounded-3xl border border-blue-200 bg-white p-6 sm:p-8 shadow-sm space-y-5 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                  Câu hỏi vừa được tạo bởi AI
                </span>

                <button
                  type="button"
                  onClick={() => setSavedSuccess(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {savedSuccess ? 'Đã Lưu Vào Ngân Hàng!' : 'Lưu Vào Ngân Hàng Câu Hỏi'}
                </button>
              </div>

              <div className="text-sm font-medium text-slate-900 leading-relaxed">
                <MathRenderer content={generatedQuestion.content} />
              </div>

              {generatedQuestion.options && Array.isArray(generatedQuestion.options) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {generatedQuestion.options.map((opt: any) => (
                    <div
                      key={opt.id}
                      className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 border border-slate-100"
                    >
                      <span className="font-bold text-slate-700 uppercase">{opt.id}.</span>
                      <MathRenderer content={opt.text} />
                    </div>
                  ))}
                </div>
              )}

              {generatedQuestion.explanation && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 text-xs">
                  <div className="font-bold text-indigo-900 mb-1">
                    Đáp án đúng:{' '}
                    <span className="font-mono text-emerald-700">
                      {typeof generatedQuestion.correct_answer === 'object'
                        ? JSON.stringify(generatedQuestion.correct_answer)
                        : String(generatedQuestion.correct_answer)}
                    </span>
                  </div>
                  <MathRenderer
                    content={generatedQuestion.explanation}
                    className="text-slate-700 leading-relaxed"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
