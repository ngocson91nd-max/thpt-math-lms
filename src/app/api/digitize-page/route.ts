import { NextRequest, NextResponse } from 'next/server';
import { parseExamLatex } from '@/lib/latex/examParser';
import { cleanLegacyBase64FromQuestions } from '@/lib/word/wordExamParser';

// Giới hạn thời gian tối đa theo chuẩn gói Vercel Hobby Serverless Function: 10 giây
export const maxDuration = 10;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    let imageBase64 = '';
    let pageIndex = 1;
    let mimeType = 'image/jpeg';

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('image') as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'Thiếu file ảnh của trang cần số hóa', code: 'MISSING_IMAGE' },
          { status: 400 }
        );
      }
      mimeType = file.type || 'image/jpeg';
      const arrayBuffer = await file.arrayBuffer();
      imageBase64 = Buffer.from(arrayBuffer).toString('base64');
      const pageIndexField = formData.get('pageIndex');
      if (pageIndexField) {
        pageIndex = parseInt(pageIndexField.toString(), 10) || 1;
      }
    } else {
      const body = await req.json();
      if (!body.imageBase64) {
        return NextResponse.json(
          { success: false, error: 'Thiếu dữ liệu ảnh base64 của trang', code: 'MISSING_IMAGE' },
          { status: 400 }
        );
      }
      imageBase64 = body.imageBase64.replace(/^data:image\/[a-zA-Z0-9\+\-]+;base64,/, '');
      if (body.pageIndex) pageIndex = body.pageIndex;
      if (body.mimeType) mimeType = body.mimeType;
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
          error: 'Chưa cấu hình GEMINI_API_KEY để số hóa tài liệu PDF.',
          code: 'NO_API_KEY',
        },
        { status: 500 }
      );
    }

    // Tên model được đọc từ biến môi trường, không viết cứng
    const selectedModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const systemPrompt = `Bạn là chuyên gia số hóa đề thi Toán THPT Việt Nam (chuẩn Bộ GD&ĐT 2025).
Nhiệm vụ của bạn: Đọc hình ảnh của TRANG ĐỀ THI này và chuyển đổi CHÍNH XÁC sang mã nguồn LaTeX gói ex_test.

QUY TẮC BẮT BUỘC VỀ ĐỊNH DẠNG EX_TEST:
1. MỖI CÂU HỎI BẮT ĐẦU BẰNG \\begin{ex} VÀ KẾT THÚC BẰNG \\end{ex}.
2. Nếu câu hỏi có 4 phương án (A, B, C, D):
   \\begin{ex}
   Nội dung câu hỏi $...$...
   \\choice
   {Phương án A}
   {\\True Phương án B đúng có \\True}
   {Phương án C}
   {Phương án D}
   \\loigiai{Lời giải nếu có...}
   \\end{ex}
3. Nếu là câu hỏi Đúng / Sai:
   \\begin{ex}
   Nội dung đề bài...
   \\choiceTF
   {\\True Ý a đúng}
   {Ý b sai}
   {\\True Ý c đúng}
   {Ý d sai}
   \\loigiai{Lời giải nếu có...}
   \\end{ex}
4. Nếu là câu hỏi Trả lời ngắn / Điền số:
   \\begin{ex}
   Nội dung câu hỏi...
   \\shortans{đáp số}
   \\loigiai{Lời giải nếu có...}
   \\end{ex}
5. KHÔNG BAO GIỜ tự sinh chuỗi HTML <img src="data:image...">.
   Giữ nguyên công thức toán ở dạng LaTeX ($...$).
   Nếu có hình vẽ hoặc đồ thị, ghi nhận xét ngắn dạng [Hình vẽ đồ thị] hoặc xuất mã TikZ nếu đơn giản.
6. Chỉ trả về mã nguồn LaTeX, không viết thêm lời chào hay bọc \`\`\`latex.`;

    const userPrompt = `Hãy bóc tách tất cả các câu hỏi toán có trong hình ảnh trang số ${pageIndex} này.`;

    let rawLatex = '';
    let lastError = '';

    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[i];
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`,
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
                        mime_type: mimeType,
                        data: imageBase64,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 4096,
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          rawLatex = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (rawLatex) break;
        } else {
          lastError = `Gemini key #${i + 1} lỗi ${geminiRes.status}: ${await geminiRes.text()}`;
        }
      } catch (err: any) {
        lastError = err.message;
      }
    }

    if (!rawLatex) {
      return NextResponse.json(
        {
          success: false,
          pageIndex,
          error: `Không thể nhận diện nội dung trang ${pageIndex}: ${lastError || 'Không có phản hồi từ AI'}`,
          code: 'AI_RECOGNITION_EMPTY',
          durationMs: Date.now() - startTime,
        },
        { status: 500 }
      );
    }

    // Phân tích LaTeX thành Question objects
    const parsed = parseExamLatex(rawLatex);
    let questions = parsed?.questions || [];

    // Làm sạch triệt để base64 khỏi các câu hỏi nhận diện được
    questions = cleanLegacyBase64FromQuestions(questions);

    // Đếm số hình vẽ phát hiện
    let figuresCount = 0;
    for (const q of questions) {
      if (q.content.includes('\\begin{tikzpicture}') || q.content.includes('\\includegraphics')) {
        figuresCount++;
      }
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      pageIndex,
      questions,
      figuresCount,
      durationMs,
      rawLatex,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Lỗi ngoại lệ khi xử lý trang PDF',
        code: 'INTERNAL_PAGE_ERROR',
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
