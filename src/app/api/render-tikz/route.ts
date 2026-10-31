import { NextRequest, NextResponse } from 'next/server';

// Bộ nhớ đệm RAM trên server để phản hồi tức thì 1ms cho các hình TikZ đã biên dịch
const serverTikzCache = new Map<string, { url: string; width: number; height: number }>();

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tikz, preamble: customPreamble } = body;

    if (!tikz || typeof tikz !== 'string') {
      return NextResponse.json({ error: 'Missing TikZ code' }, { status: 400 });
    }

    const cleanTikz = tikz.trim();
    const cacheKey = hashString(cleanTikz);

    if (serverTikzCache.has(cacheKey)) {
      return NextResponse.json({
        success: true,
        cached: true,
        ...serverTikzCache.get(cacheKey)!,
      });
    }

    // Preamble chuẩn chứa toàn bộ các gói TikZ Toán THPT Việt Nam
    const defaultPreamble = [
      '\\usepackage{amsmath}',
      '\\usepackage{amsfonts}',
      '\\usepackage{amssymb}',
      '\\usepackage{esvect}',
      '\\usepackage{tikz}',
      '\\usepackage{tikz-3dplot}',
      '\\usepackage{tkz-euclide}',
      '\\usepackage{pgfplots}',
      '\\pgfplotsset{compat=1.18}',
      '\\usetikzlibrary{calc,arrows.meta,positioning,angles,quotes,intersections,patterns,3d,backgrounds,decorations.pathmorphing}',
    ].join('\n');

    const preamble = customPreamble ? `${defaultPreamble}\n${customPreamble}` : defaultPreamble;

    const postData = new URLSearchParams({
      formula: cleanTikz,
      fsize: '18px',
      fcolor: '000000',
      mode: '0',
      out: '1',
      remhost: 'quicklatex.com',
      preamble,
    }).toString();

    const response = await fetch('https://quicklatex.com/latex3.f', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: postData,
    });

    if (!response.ok) {
      throw new Error(`QuickLaTeX returned status ${response.status}`);
    }

    const resultText = await response.text();
    const lines = resultText.trim().split('\n');

    // QuickLaTeX trả về dòng 1: mã lỗi (0 là thành công), dòng 2: URL ảnh PNG
    const statusCode = parseInt(lines[0]?.trim() || '-1', 10);
    if (statusCode !== 0) {
      const errorMsg = lines.slice(1).join('\n') || 'TeX compilation error';
      return NextResponse.json({ success: false, error: errorMsg }, { status: 422 });
    }

    const imgInfo = lines[1]?.trim().split(/\s+/) || [];
    const imgUrl = imgInfo[0];
    const width = parseInt(imgInfo[2] || '320', 10);
    const height = parseInt(imgInfo[3] || '240', 10);

    const result = { url: imgUrl, width, height };
    serverTikzCache.set(cacheKey, result);

    return NextResponse.json({
      success: true,
      cached: false,
      ...result,
    });
  } catch (error: any) {
    console.error('Error rendering TikZ via server API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
