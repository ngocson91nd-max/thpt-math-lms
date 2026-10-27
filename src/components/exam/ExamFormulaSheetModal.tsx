'use client';

import React, { useState } from 'react';
import { X, BookOpen, Search } from 'lucide-react';
import MathRenderer from '@/components/math/MathRenderer';

interface ExamFormulaSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExamFormulaSheetModal: React.FC<ExamFormulaSheetModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'dao_ham' | 'nguyen_ham' | 'luong_giac' | 'oxyz'>('dao_ham');

  if (!isOpen) return null;

  const FORMULAS = {
    dao_ham: [
      { name: 'Hàm lũy thừa', fx: "$(x^n)' = n x^{n-1}$", fu: "$(u^n)' = n u^{n-1} u'$" },
      { name: 'Căn bậc hai', fx: "$(\\sqrt{x})' = \\frac{1}{2\\sqrt{x}}$", fu: "$(\\sqrt{u})' = \\frac{u'}{2\\sqrt{u}}$" },
      { name: 'Phân thức bậc nhất', fx: "$\\left(\\frac{1}{x}\\right)' = -\\frac{1}{x^2}$", fu: "$\\left(\\frac{ax+b}{cx+d}\\right)' = \\frac{ad-bc}{(cx+d)^2}$" },
      { name: 'Hàm số lượng giác sin', fx: "$(\\sin x)' = \\cos x$", fu: "$(\\sin u)' = u' \\cos u$" },
      { name: 'Hàm số lượng giác cos', fx: "$(\\cos x)' = -\\sin x$", fu: "$(\\cos u)' = -u' \\sin u$" },
      { name: 'Hàm số lượng giác tan', fx: "$(\\tan x)' = \\frac{1}{\\cos^2 x} = 1 + \\tan^2 x$", fu: "$(\\tan u)' = \\frac{u'}{\\cos^2 u}$" },
      { name: 'Hàm số mũ cơ số e', fx: "$(e^x)' = e^x$", fu: "$(e^u)' = u' e^u$" },
      { name: 'Hàm số mũ cơ số a', fx: "$(a^x)' = a^x \\ln a$", fu: "$(a^u)' = u' a^u \\ln a$" },
      { name: 'Logarit tự nhiên ln', fx: "$(\\ln x)' = \\frac{1}{x}$", fu: "$(\\ln u)' = \\frac{u'}{u}$" },
      { name: 'Logarit cơ số a', fx: "$(\\log_a x)' = \\frac{1}{x \\ln a}$", fu: "$(\\log_a u)' = \\frac{u'}{u \\ln a}$" },
    ],
    nguyen_ham: [
      { name: 'Nguyên hàm hằng số', fx: "$\\int 0\\,\\mathrm{d}x = C$", fu: "$\\int k\\,\\mathrm{d}x = kx + C$" },
      { name: 'Nguyên hàm lũy thừa', fx: "$\\int x^n\\,\\mathrm{d}x = \\frac{x^{n+1}}{n+1} + C\\; (n\\neq -1)$", fu: "$\\int (ax+b)^n\\,\\mathrm{d}x = \\frac{(ax+b)^{n+1}}{a(n+1)} + C$" },
      { name: 'Nguyên hàm phân thức', fx: "$\\int \\frac{1}{x}\\,\\mathrm{d}x = \\ln|x| + C$", fu: "$\\int \\frac{1}{ax+b}\\,\\mathrm{d}x = \\frac{1}{a}\\ln|ax+b| + C$" },
      { name: 'Nguyên hàm mũ e^x', fx: "$\\int e^x\\,\\mathrm{d}x = e^x + C$", fu: "$\\int e^{ax+b}\\,\\mathrm{d}x = \\frac{1}{a} e^{ax+b} + C$" },
      { name: 'Nguyên hàm mũ a^x', fx: "$\\int a^x\\,\\mathrm{d}x = \\frac{a^x}{\\ln a} + C$", fu: "$\\int a^{kx}\\,\\mathrm{d}x = \\frac{a^{kx}}{k\\ln a} + C$" },
      { name: 'Nguyên hàm cos', fx: "$\\int \\cos x\\,\\mathrm{d}x = \\sin x + C$", fu: "$\\int \\cos(ax+b)\\,\\mathrm{d}x = \\frac{1}{a}\\sin(ax+b) + C$" },
      { name: 'Nguyên hàm sin', fx: "$\\int \\sin x\\,\\mathrm{d}x = -\\cos x + C$", fu: "$\\int \\sin(ax+b)\\,\\mathrm{d}x = -\\frac{1}{a}\\cos(ax+b) + C$" },
      { name: 'Nguyên hàm 1/cos²x', fx: "$\\int \\frac{1}{\\cos^2 x}\\,\\mathrm{d}x = \\tan x + C$", fu: "$\\int \\frac{1}{\\sin^2 x}\\,\\mathrm{d}x = -\\cot x + C$" },
      { name: 'Tích phân từng phần', fx: "$\\int u\\,\\mathrm{d}v = uv - \\int v\\,\\mathrm{d}u$", fu: "$\\int_a^b u\\,\\mathrm{d}v = uv\\Big|_a^b - \\int_a^b v\\,\\mathrm{d}u$" },
    ],
    luong_giac: [
      { name: 'Hệ thức cơ bản', fx: "$\\sin^2 x + \\cos^2 x = 1$", fu: "$1 + \\tan^2 x = \\frac{1}{\\cos^2 x}$" },
      { name: 'Công thức cộng', fx: "$\\cos(a\\pm b) = \\cos a\\cos b \\mp \\sin a\\sin b$", fu: "$\\sin(a\\pm b) = \\sin a\\cos b \\pm \\cos a\\sin b$" },
      { name: 'Công thức nhân đôi', fx: "$\\sin 2x = 2\\sin x \\cos x$", fu: "$\\cos 2x = \\cos^2 x - \\sin^2 x = 2\\cos^2 x - 1 = 1 - 2\\sin^2 x$" },
      { name: 'Công thức hạ bậc', fx: "$\\sin^2 x = \\frac{1 - \\cos 2x}{2}$", fu: "$\\cos^2 x = \\frac{1 + \\cos 2x}{2}$" },
      { name: 'Biến đổi tích thành tổng', fx: "$\\cos a\\cos b = \\frac{1}{2}[\\cos(a-b) + \\cos(a+b)]$", fu: "$\\sin a\\sin b = \\frac{1}{2}[\\cos(a-b) - \\cos(a+b)]$" },
    ],
    oxyz: [
      { name: 'Tọa độ vectơ & điểm', fx: "$\\vec{u} = (x_1, y_1, z_1), \\vec{v} = (x_2, y_2, z_2)$", fu: "$\\vec{u}\\cdot\\vec{v} = x_1 x_2 + y_1 y_2 + z_1 z_2$" },
      { name: 'Độ dài vectơ & Khoảng cách', fx: "$|\\vec{u}| = \\sqrt{x_1^2 + y_1^2 + z_1^2}$", fu: "$AB = \\sqrt{(x_B-x_A)^2 + (y_B-y_A)^2 + (z_B-z_A)^2}$" },
      { name: 'Tích có hướng [u, v]', fx: "$[\\vec{u}, \\vec{v}] = \\left( \\begin{vmatrix} y_1 & z_1 \\\\ y_2 & z_2 \\end{vmatrix}, \\begin{vmatrix} z_1 & x_1 \\\\ z_2 & x_2 \\end{vmatrix}, \\begin{vmatrix} x_1 & y_1 \\\\ x_2 & y_2 \\end{vmatrix} \\right)$", fu: "$S_{\\Delta ABC} = \\frac{1}{2}|[\\overrightarrow{AB}, \\overrightarrow{AC}]|$" },
      { name: 'Mặt phẳng (P)', fx: "$Ax + By + Cz + D = 0\\; (A^2+B^2+C^2 > 0)$", fu: "$d(M_0, (P)) = \\frac{|Ax_0 + By_0 + Cz_0 + D|}{\\sqrt{A^2 + B^2 + C^2}}$" },
      { name: 'Mặt cầu tâm I(a,b,c) bán kính R', fx: "$(x-a)^2 + (y-b)^2 + (z-c)^2 = R^2$", fu: "$x^2 + y^2 + z^2 - 2ax - 2by - 2cz + d = 0\\; (R=\\sqrt{a^2+b^2+c^2-d})$" },
      { name: 'Thể tích khối chóp & lăng trụ', fx: "$V_{\\text{chóp}} = \\frac{1}{3} B \\cdot h$", fu: "$V_{\\text{lăng trụ}} = B \\cdot h$" },
      { name: 'Hình nón, trụ, cầu', fx: "$V_{\\text{nón}} = \\frac{1}{3}\\pi r^2 h,\\; S_{xq} = \\pi r l$", fu: "$V_{\\text{cầu}} = \\frac{4}{3}\\pi R^3,\\; S_{\\text{cầu}} = 4\\pi R^2$" },
    ],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Sổ Tay Công Thức Toán THPT</h3>
              <p className="text-xs text-slate-500">Tra cứu nhanh đạo hàm, nguyên hàm, lượng giác và tọa độ Oxyz</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6 gap-2 text-xs font-semibold overflow-x-auto">
          {[
            { id: 'dao_ham', label: '1. Bảng Đạo Hàm' },
            { id: 'nguyen_ham', label: '2. Nguyên Hàm & Tích Phân' },
            { id: 'luong_giac', label: '3. Công Thức Lượng Giác' },
            { id: 'oxyz', label: '4. Hình Không Gian & Oxyz' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-xs">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-1/4">Tên công thức</th>
                  <th className="py-3 px-4 w-3/8">Hàm cơ bản $x$</th>
                  <th className="py-3 px-4 w-3/8">Hàm hợp $u(x)$ / Dạng mở rộng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {FORMULAS[activeTab].map((item, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-700 text-xs">{item.name}</td>
                    <td className="py-3.5 px-4 text-slate-900">
                      <MathRenderer content={item.fx} inline />
                    </td>
                    <td className="py-3.5 px-4 text-slate-900">
                      <MathRenderer content={item.fu} inline />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
          <span>Hệ thống học tập THPT Toán Thầy Sơn</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-blue-600 px-4 py-1.5 font-semibold text-white hover:bg-blue-500 transition"
          >
            Đóng bảng tra cứu
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamFormulaSheetModal;
