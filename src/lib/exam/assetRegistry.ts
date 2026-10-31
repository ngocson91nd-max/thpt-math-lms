/**
 * Hệ thống Quản lý Tài nguyên Đồ họa Đề thi (Exam Asset Registry)
 * 
 * NGUYÊN TẮC BẤT DI BẤT DỊCH (CLAUDE SONNET & THẦY SƠN):
 * 1. content và options KHÔNG BAO GIỜ chứa data URI (data:image/...) hay HTML thô (<img>).
 * 2. Giữ mã TikZ gốc trong content.
 * 3. Ảnh raster/SVG đã dựng được lưu ở Storage / Registry theo SHA-256 hash.
 * 4. Trong content/options, tham chiếu ảnh bằng cú pháp LaTeX chuẩn: \includegraphics{<hash>.<ext>}.
 * 5. Bộ render tra cứu hash ra URL lúc hiển thị trên UI.
 */

export interface ExamAsset {
  id: string; // e.g. "asset_a1b2c3d4.svg"
  filename: string;
  mimeType: string;
  dataUrl: string;
  base64: string;
}

// Bảng lưu trữ Asset trong bộ nhớ toàn cục (hoạt động đồng nhất trên cả client và server)
const globalRegistry = new Map<string, ExamAsset>();

/**
 * Tính hash ngắn gọn an toàn từ chuỗi (tương thích cả browser và serverless)
 */
export function computeStringHash(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  const len = Math.min(str.length, 5000);
  for (let i = 0; i < len; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return Math.abs(combined).toString(16).padStart(12, '0');
}

/**
 * Đăng ký một tài nguyên ảnh / SVG vào Registry và trả về mã định danh chuẩn LaTeX
 */
export function registerExamAsset(
  base64: string,
  mimeType: string,
  ext: string,
  prefix = 'asset'
): string {
  const hash = computeStringHash(base64);
  const cleanExt = ext.replace(/^\./, '').toLowerCase();
  const assetId = `${prefix}_${hash}.${cleanExt}`;
  const dataUrl = `data:${mimeType};base64,${base64}`;

  globalRegistry.set(assetId, {
    id: assetId,
    filename: assetId,
    mimeType,
    dataUrl,
    base64,
  });

  return assetId;
}

/**
 * Tra cứu asset theo ID để lấy URL hiển thị
 */
export function getExamAsset(assetId: string): ExamAsset | undefined {
  return globalRegistry.get(assetId.trim());
}

/**
 * Tra cứu URL hiển thị từ asset ID hoặc trả về chính nó nếu là URL hợp lệ
 */
export function resolveAssetUrl(src: string): string {
  const cleanSrc = src.trim();
  const asset = globalRegistry.get(cleanSrc);
  if (asset) return asset.dataUrl;
  return cleanSrc;
}

/**
 * Dọn sạch và chuyển đổi mọi chuỗi base64 hoặc thẻ <img src="data:..."> còn sót trong chuỗi thành \includegraphics{...}
 */
export function sanitizeNoBase64OrRawHtml(text: string): string {
  if (!text) return '';

  // 1. Chuyển đổi mọi thẻ <img src="data:image/([^;]+);base64,([^"']+)" ...> thành \includegraphics{asset_<hash>.<ext>}
  let clean = text.replace(
    /<img\b[^>]*src=["']data:image\/([a-zA-Z0-9\+\-]+);base64,([A-Za-z0-9+/=]+)["'][^>]*>/gi,
    (_match, mimeSubtype, base64) => {
      const ext = mimeSubtype === 'svg+xml' ? 'svg' : mimeSubtype;
      const mime = `image/${mimeSubtype}`;
      const assetId = registerExamAsset(base64, mime, ext, 'fig');
      return `\\includegraphics{${assetId}}`;
    }
  );

  // 2. Chuyển đổi các chuỗi data:image trần còn lọt vào
  clean = clean.replace(
    /data:image\/([a-zA-Z0-9\+\-]+);base64,([A-Za-z0-9+/=]+)/gi,
    (_match, mimeSubtype, base64) => {
      const ext = mimeSubtype === 'svg+xml' ? 'svg' : mimeSubtype;
      const mime = `image/${mimeSubtype}`;
      const assetId = registerExamAsset(base64, mime, ext, 'asset');
      return `\\includegraphics{${assetId}}`;
    }
  );

  // 3. Loại bỏ thẻ <script>
  clean = clean.replace(/<script\b[\s\S]*?<\/script>/gi, '');

  return clean;
}

/**
 * Kiểm tra xem chuỗi có bị ô nhiễm bởi base64 hoặc <img> hay không
 */
export function containsBase64OrImgTag(str: string): boolean {
  if (!str) return false;
  return /(?:data:image|<img\b|<script\b)/i.test(str);
}
