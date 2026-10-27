'use client';

import React, { useState } from 'react';
import { X, Delete, RotateCcw, Calculator as CalcIcon } from 'lucide-react';

interface ExamCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExamCalculator: React.FC<ExamCalculatorProps> = ({ isOpen, onClose }) => {
  const [display, setDisplay] = useState('0');
  const [formula, setFormula] = useState('');
  const [isRad, setIsRad] = useState(false); // Mặc định Đơn vị Độ (DEG) phù hợp học sinh THPT
  const [hasEvaluated, setHasEvaluated] = useState(false);

  if (!isOpen) return null;

  const handleNum = (num: string) => {
    if (display === '0' || hasEvaluated) {
      setDisplay(num);
      setHasEvaluated(false);
    } else {
      setDisplay(display + num);
    }
  };

  const handleDot = () => {
    if (hasEvaluated) {
      setDisplay('0.');
      setHasEvaluated(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleOp = (op: string) => {
    setHasEvaluated(false);
    setFormula((prev) => (prev ? `${prev} ${display} ${op}` : `${display} ${op}`));
    setDisplay('0');
  };

  const handleClear = () => {
    setDisplay('0');
    setFormula('');
    setHasEvaluated(false);
  };

  const handleBackspace = () => {
    if (hasEvaluated) {
      handleClear();
      return;
    }
    if (display.length <= 1) {
      setDisplay('0');
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const handleFunc = (fnName: string) => {
    const num = parseFloat(display);
    if (isNaN(num)) return;

    let res = 0;
    const angleRatio = isRad ? 1 : Math.PI / 180;

    switch (fnName) {
      case 'sin':
        res = Math.sin(num * angleRatio);
        break;
      case 'cos':
        res = Math.cos(num * angleRatio);
        break;
      case 'tan':
        res = Math.tan(num * angleRatio);
        break;
      case 'sqrt':
        if (num < 0) {
          setDisplay('Lỗi toán học');
          setHasEvaluated(true);
          return;
        }
        res = Math.sqrt(num);
        break;
      case 'sqr':
        res = num * num;
        break;
      case 'inv':
        if (num === 0) {
          setDisplay('Lỗi chia 0');
          setHasEvaluated(true);
          return;
        }
        res = 1 / num;
        break;
      case 'log':
        if (num <= 0) {
          setDisplay('Lỗi toán học');
          setHasEvaluated(true);
          return;
        }
        res = Math.log10(num);
        break;
      case 'ln':
        if (num <= 0) {
          setDisplay('Lỗi toán học');
          setHasEvaluated(true);
          return;
        }
        res = Math.log(num);
        break;
      case 'pi':
        res = Math.PI;
        break;
      case 'e':
        res = Math.E;
        break;
      case 'neg':
        res = -num;
        break;
    }

    // Làm tròn đến 8 chữ số thập phân để tránh sai số dấu phẩy động
    const formatted = Math.round(res * 1e8) / 1e8;
    setDisplay(formatted.toString());
    setHasEvaluated(true);
  };

  const handleEquals = () => {
    if (!formula) return;
    const fullExpr = `${formula} ${display}`.trim();
    try {
      // Chuyển đổi biểu thức an toàn
      const sanitized = fullExpr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/[^0-9\+\-\*\/\.\s]/g, '');

      // Tính toán an toàn từng bước
      const tokens = sanitized.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return;

      // Xử lý nhân chia trước, cộng trừ sau
      const numStack: number[] = [];
      const opStack: string[] = [];

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (['+', '-', '*', '/'].includes(token)) {
          opStack.push(token);
        } else {
          let currentNum = parseFloat(token);
          if (opStack.length > 0 && (opStack[opStack.length - 1] === '*' || opStack[opStack.length - 1] === '/')) {
            const op = opStack.pop()!;
            const prevNum = numStack.pop()!;
            if (op === '/' && currentNum === 0) {
              setDisplay('Lỗi chia 0');
              setFormula('');
              setHasEvaluated(true);
              return;
            }
            currentNum = op === '*' ? prevNum * currentNum : prevNum / currentNum;
          }
          numStack.push(currentNum);
        }
      }

      let result = numStack[0] || 0;
      for (let i = 0; i < opStack.length; i++) {
        const op = opStack[i];
        const nextNum = numStack[i + 1] || 0;
        if (op === '+') result += nextNum;
        else if (op === '-') result -= nextNum;
      }

      const formatted = Math.round(result * 1e8) / 1e8;
      setDisplay(formatted.toString());
      setFormula(fullExpr + ' =');
      setHasEvaluated(true);
    } catch {
      setDisplay('Lỗi tính');
      setHasEvaluated(true);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-3xl border border-slate-700 bg-slate-900 text-white shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <CalcIcon className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">Máy tính THPT</span>
          <button
            type="button"
            onClick={() => setIsRad(!isRad)}
            className="ml-2 rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300 hover:bg-slate-700 transition"
          >
            {isRad ? 'RAD' : 'DEG'}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Screen */}
      <div className="p-4 bg-slate-950 text-right space-y-1">
        <div className="h-4 text-[11px] font-mono text-slate-400 truncate">{formula || '\u00A0'}</div>
        <div className="text-2xl font-mono font-bold text-cyan-300 tracking-wider truncate">{display}</div>
      </div>

      {/* Scientific Function Row */}
      <div className="grid grid-cols-4 gap-1 p-2 bg-slate-900 border-b border-slate-800 text-xs">
        <button
          type="button"
          onClick={() => handleFunc('sin')}
          className="rounded-lg bg-slate-800/80 py-1.5 font-semibold text-slate-300 hover:bg-slate-700 transition"
        >
          sin
        </button>
        <button
          type="button"
          onClick={() => handleFunc('cos')}
          className="rounded-lg bg-slate-800/80 py-1.5 font-semibold text-slate-300 hover:bg-slate-700 transition"
        >
          cos
        </button>
        <button
          type="button"
          onClick={() => handleFunc('tan')}
          className="rounded-lg bg-slate-800/80 py-1.5 font-semibold text-slate-300 hover:bg-slate-700 transition"
        >
          tan
        </button>
        <button
          type="button"
          onClick={() => handleFunc('sqrt')}
          className="rounded-lg bg-slate-800/80 py-1.5 font-semibold text-slate-300 hover:bg-slate-700 transition"
        >
          √x
        </button>
        <button
          type="button"
          onClick={() => handleFunc('sqr')}
          className="rounded-lg bg-slate-800/80 py-1.5 font-semibold text-slate-300 hover:bg-slate-700 transition"
        >
          x²
        </button>
        <button
          type="button"
          onClick={() => handleFunc('log')}
          className="rounded-lg bg-slate-800/80 py-1.5 font-semibold text-slate-300 hover:bg-slate-700 transition"
        >
          log
        </button>
        <button
          type="button"
          onClick={() => handleFunc('ln')}
          className="rounded-lg bg-slate-800/80 py-1.5 font-semibold text-slate-300 hover:bg-slate-700 transition"
        >
          ln
        </button>
        <button
          type="button"
          onClick={() => handleFunc('pi')}
          className="rounded-lg bg-slate-800/80 py-1.5 font-semibold text-slate-300 hover:bg-slate-700 transition"
        >
          π
        </button>
      </div>

      {/* Main Keypad */}
      <div className="grid grid-cols-4 gap-1.5 p-3 bg-slate-900">
        <button
          type="button"
          onClick={handleClear}
          className="rounded-xl bg-rose-600/90 py-2.5 font-bold text-xs text-white hover:bg-rose-500 transition shadow-xs"
        >
          AC
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          className="flex items-center justify-center rounded-xl bg-slate-800 py-2.5 text-slate-300 hover:bg-slate-700 transition"
        >
          <Delete className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => handleFunc('neg')}
          className="rounded-xl bg-slate-800 py-2.5 font-semibold text-sm text-slate-300 hover:bg-slate-700 transition"
        >
          ±
        </button>
        <button
          type="button"
          onClick={() => handleOp('÷')}
          className="rounded-xl bg-cyan-600/80 py-2.5 font-bold text-base text-white hover:bg-cyan-500 transition"
        >
          ÷
        </button>

        {['7', '8', '9'].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleNum(n)}
            className="rounded-xl bg-slate-800/90 py-2.5 font-bold text-sm text-white hover:bg-slate-700 transition"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleOp('×')}
          className="rounded-xl bg-cyan-600/80 py-2.5 font-bold text-base text-white hover:bg-cyan-500 transition"
        >
          ×
        </button>

        {['4', '5', '6'].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleNum(n)}
            className="rounded-xl bg-slate-800/90 py-2.5 font-bold text-sm text-white hover:bg-slate-700 transition"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleOp('-')}
          className="rounded-xl bg-cyan-600/80 py-2.5 font-bold text-base text-white hover:bg-cyan-500 transition"
        >
          −
        </button>

        {['1', '2', '3'].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleNum(n)}
            className="rounded-xl bg-slate-800/90 py-2.5 font-bold text-sm text-white hover:bg-slate-700 transition"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleOp('+')}
          className="rounded-xl bg-cyan-600/80 py-2.5 font-bold text-base text-white hover:bg-cyan-500 transition"
        >
          +
        </button>

        <button
          type="button"
          onClick={() => handleNum('0')}
          className="col-span-2 rounded-xl bg-slate-800/90 py-2.5 font-bold text-sm text-white hover:bg-slate-700 transition"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleDot}
          className="rounded-xl bg-slate-800/90 py-2.5 font-bold text-sm text-white hover:bg-slate-700 transition"
        >
          .
        </button>
        <button
          type="button"
          onClick={handleEquals}
          className="rounded-xl bg-emerald-600 py-2.5 font-bold text-base text-white hover:bg-emerald-500 transition shadow-xs"
        >
          =
        </button>
      </div>
    </div>
  );
};

export default ExamCalculator;
