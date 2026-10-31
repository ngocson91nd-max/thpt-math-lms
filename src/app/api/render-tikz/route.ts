import { NextRequest, NextResponse } from 'next/server';
import { renderTikzToSvg } from '@/lib/math/tikzSvgRenderer';
import { parseTkzTabCode, generateTkzTabSvg } from '@/lib/math/tkzTabRenderer';

// Bộ nhớ đệm RAM trên server cho các hình TikZ đã dựng sang SVG thuần túy
const serverTikzCache = new Map<string, { svg: string }>();

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
    const { tikz } = body;

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

    // 1. Thử render Bảng biến thiên (tkz-tab) sang SVG siêu tốc 0ms
    if (cleanTikz.includes('\\tkzTabInit') || cleanTikz.includes('tkzTab')) {
      const parsedTab = parseTkzTabCode(cleanTikz);
      if (parsedTab) {
        const svg = generateTkzTabSvg(parsedTab);
        const result = { svg };
        serverTikzCache.set(cacheKey, result);
        return NextResponse.json({
          success: true,
          cached: false,
          ...result,
        });
      }
    }

    // 2. Thử render đồ thị hàm số và hình học Oxy sang SVG thuần túy (0ms)
    const pureSvg = renderTikzToSvg(cleanTikz);
    if (pureSvg) {
      const result = { svg: pureSvg };
      serverTikzCache.set(cacheKey, result);
      return NextResponse.json({
        success: true,
        cached: false,
        ...result,
      });
    }

    // 3. Đối với các hình 3D phức tạp, trả về false để client kích hoạt TikzJax WebAssembly
    return NextResponse.json(
      {
        success: false,
        error: 'Hình vẽ 3D/phức tạp được chuyển giao cho client WebAssembly TikzJax',
      },
      { status: 422 }
    );
  } catch (error: any) {
    console.error('Error rendering TikZ via server API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server render failed' },
      { status: 500 }
    );
  }
}
