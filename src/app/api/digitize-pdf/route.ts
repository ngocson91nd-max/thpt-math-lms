import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60; // Hỗ trợ xử lý tài liệu PDF dài tới 60s

export async function POST(req: NextRequest) {
  try {
    let pdfBase64 = '';
    let fileName = 'de-thi.pdf';

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ success: false, error: 'Vui lòng tải lên file PDF' }, { status: 400 });
      }
      fileName = file.name;
      const arrayBuffer = await file.arrayBuffer();
      pdfBase64 = Buffer.from(arrayBuffer).toString('base64');
    } else {
      const body = await req.json();
      if (!body.pdfBase64) {
        return NextResponse.json({ success: false, error: 'Thiếu dữ liệu PDF base64' }, { status: 400 });
      }
      pdfBase64 = body.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      if (body.fileName) fileName = body.fileName;
    }

    const rawKeys = process.env.GEMINI_API_KEY || '';
    const geminiKeys = rawKeys
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k && !k.includes('your-google-gemini-api-key'));

    if (geminiKeys.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Chưa cấu hình GEMINI_API_KEY để số hóa tài liệu PDF bằng AI Vision.',
        },
        { status: 500 }
      );
    }

    const systemPrompt = `Bạn là chuyên gia số 1 về số hóa đề thi Toán THPT Việt Nam (chuẩn cấu trúc Bộ Giáo dục & Đào tạo 2025).
Nhiệm vụ của bạn: Đọc toàn bộ tài liệu PDF đính kèm (gồm cả công thức toán, hình vẽ, bảng biến thiên, bảng đáp án) và chuyển đổi CHÍNH XÁC 100% sang mã nguồn LaTeX gói ex_test.

QUY TẮC BẮT BUỘC VỀ ĐỊNH DẠNG EX_TEST:
1. MỖI CÂU HỎI BẮT ĐẦU BẰNG \\begin{ex} VÀ KẾT THÚC BẰNG \\end{ex}.
2. Phần I (Trắc nghiệm 4 phương án A, B, C, D):
   Dùng môi trường \\choice:
   \\begin{ex}
   Nội dung câu hỏi có công thức $...$...
   \\choice
   {Phương án A}
   {\\True Phương án B đúng có \\True}
   {Phương án C}
   {Phương án D}
   \\loigiai{Lời giải chi tiết nếu có trong đề...}
   \\end{ex}

3. Phần II (Trắc nghiệm Đúng / Sai 4 ý a, b, c, d):
   Dùng môi trường \\choiceTF (ý đúng có \\True, ý sai không có):
   \\begin{ex}
   Nội dung đề bài...
   \\choiceTF
   {\\True Mệnh đề a đúng}
   {Mệnh đề b sai}
   {\\True Mệnh đề c đúng}
   {Mệnh đề d sai}
   \\loigiai{Lời giải chi tiết...}
   \\end{ex}

4. Phần III (Trả lời ngắn / Điền số):
   Dùng lệnh \\shortans{đáp số}:
   \\begin{ex}
   Nội dung câu hỏi tính toán...
   \\shortans{1440}
   \\loigiai{Lời giải chi tiết...}
   \\end{ex}

5. Phần IV (Tự luận - nếu có):
   \\begin{ex}
   Nội dung câu hỏi tự luận...
   \\loigiai{Lời giải hoặc hướng dẫn chấm...}
   \\end{ex}

6. BẢO TOÀN CÔNG THỨC TOÁN:
   - Dùng cú pháp LaTeX chuẩn: $x^2 + 1$, \\dfrac{a}{b}, \\sqrt{x}, \\int_{a}^{b}, \\lim_{x \\to 0}, v.v.
   - Nếu câu hỏi có hình vẽ trong PDF, hãy tóm tắt nội dung hình vẽ hoặc tạo mã TikZ nếu có thể, hoặc ghi [Hình vẽ kèm theo].
7. TRẢ VỀ DUY NHẤT MÃ NGUỒN LATEX, KHÔNG CÓ LỜI MỞ ĐẦU, KHÔNG DÙNG BACKTICK \`\`\`latex.`;

    const userPrompt = `Hãy số hóa toàn bộ các câu hỏi từ đề thi PDF đính kèm theo cấu trúc ex_test LaTeX. Đảm bảo bóc tách đầy đủ tất cả các câu từ Câu 1 đến hết đề thi.`;

    const selectedModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    let activeModel = selectedModel;

    let res: Response | null = null;
    let rawLatex = '';

    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: `${systemPrompt}\n\n${userPrompt}` },
                    {
                      inline_data: {
                        mime_type: 'application/pdf',
                        data: pdfBase64,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
              },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          rawLatex = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (rawLatex) break;
        } else {
          console.warn(`Gemini key #${i + 1} lỗi ${res.status}:`, await res.text());
        }
      } catch (err: any) {
        console.warn(`Lỗi gọi Gemini key #${i + 1}:`, err.message);
      }
    }

    if (!rawLatex) {
      return NextResponse.json(
        {
          success: false,
          error: 'Không thể số hóa tài liệu PDF qua AI. Thầy/Cô vui lòng kiểm tra lại file PDF hoặc sử dụng chế độ Thi nhanh PDF nguyên bản.',
        },
        { status: 502 }
      );
    }

    // Làm sạch mã LaTeX trả về (bỏ code fence nếu có)
    const cleanLatex = rawLatex
      .replace(/^```(?:latex|tex)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    return NextResponse.json({
      success: true,
      fileName,
      latex: cleanLatex,
      modelUsed: activeModel,
    });
  } catch (error: any) {
    console.error('Lỗi API digitize-pdf:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Lỗi xử lý file PDF' },
      { status: 500 }
    );
  }
}
