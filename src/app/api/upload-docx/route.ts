import { NextRequest, NextResponse } from 'next/server';
import { parseWordDocx } from '@/lib/word/wordExamParser';
import { getAllExamAssets } from '@/lib/exam/assetRegistry';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Vui lòng đính kèm file .docx' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const { questions, rawText } = await parseWordDocx(arrayBuffer);
    const assets = getAllExamAssets();

    return NextResponse.json({
      success: true,
      filename: file.name,
      count: questions.length,
      questions,
      assets,
      rawText: rawText.substring(0, 500) + '...',
    });
  } catch (error: any) {
    console.error('Lỗi API upload-docx:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Không thể phân tích file Word' },
      { status: 500 }
    );
  }
}
