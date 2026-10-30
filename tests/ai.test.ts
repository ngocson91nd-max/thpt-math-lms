import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/ai/route';
import { NextRequest } from 'next/server';

describe('AI Similar Question Generator', () => {
  it('tạo bài toán tương tự dạng lượng giác chuẩn xác', async () => {
    const req = new NextRequest('http://localhost:3000/api/ai', {
      method: 'POST',
      body: JSON.stringify({
        action: 'generate_similar_question',
        questionContent: 'Cho $\\cos x = \\dfrac{4}{5}$, $x \\in \\left(-\\dfrac{\\pi}{2}; 0\\right)$. Giá trị của $\\sin 2x$ là',
        options: [
          { id: 'A', text: '$-\\dfrac{24}{25}$' },
          { id: 'B', text: '$-\\dfrac{1}{5}$' },
          { id: 'C', text: '$\\dfrac{1}{5}$' },
          { id: 'D', text: '$\\dfrac{24}{25}$' }
        ],
        correctAnswer: 'A',
        explanation: 'Vì $x \\in \\left(-\\dfrac{\\pi}{2}; 0\\right)$ nên $\\sin x < 0$.',
        topic: 'Lượng giác'
      }),
    });

    const res = await POST(req);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.similarQuestion).toBeDefined();
    expect(data.similarQuestion.content).toContain('\\cos');
    expect(data.similarQuestion.options.length).toBe(4);
    expect(data.similarQuestion.correct_answer).toBe('A');
  });
});
