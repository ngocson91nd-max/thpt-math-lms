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
  base64?: string;
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
 * Tự động đồng bộ các asset từ localStorage/sessionStorage vào globalRegistry
 */
export function hydrateAssetsFromBrowserStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    // 1. Quét sessionStorage (chứa các asset vừa được nạp từ modal tải đề ở tab hiện tại)
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('asset_')) {
        const id = key.substring(6);
        const dataUrl = sessionStorage.getItem(key);
        if (dataUrl) {
          globalRegistry.set(id, { id, filename: id, mimeType: '', dataUrl, base64: '' });
          // Đồng bộ sang localStorage để các tab làm bài thi của học sinh cũng nhận được tức thì
          try {
            localStorage.setItem(key, dataUrl);
          } catch {}
        }
      }
    }

    // 2. Quét localStorage (toàn cục cho mọi tab trên cùng domain)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('asset_')) {
        const id = key.substring(6);
        const dataUrl = localStorage.getItem(key);
        if (dataUrl && !globalRegistry.has(id)) {
          globalRegistry.set(id, { id, filename: id, mimeType: '', dataUrl, base64: '' });
        }
      }
    }

    // 3. Quét exam_assets
    const cached = localStorage.getItem('exam_assets') || sessionStorage.getItem('exam_assets');
    if (cached) {
      const list = JSON.parse(cached);
      if (Array.isArray(list)) {
        for (const a of list) {
          if (a && a.id && a.dataUrl && !globalRegistry.has(a.id)) {
            globalRegistry.set(a.id, a);
            try {
              localStorage.setItem(`asset_${a.id}`, a.dataUrl);
            } catch {}
          }
        }
      }
    }

    // 4. Quét danh sách đề thi lms_exams (nếu đề thi có kèm assets)
    const savedExamsRaw = localStorage.getItem('lms_exams');
    if (savedExamsRaw) {
      const exams = JSON.parse(savedExamsRaw);
      if (Array.isArray(exams)) {
        for (const ex of exams) {
          if (Array.isArray(ex.assets)) {
            for (const a of ex.assets) {
              if (a && a.id && a.dataUrl && !globalRegistry.has(a.id)) {
                globalRegistry.set(a.id, a);
                try {
                  localStorage.setItem(`asset_${a.id}`, a.dataUrl);
                } catch {}
              }
            }
          }
        }
      }
    }
  } catch {}
}

// Chạy tự động khi module được nạp trên browser
if (typeof window !== 'undefined') {
  hydrateAssetsFromBrowserStorage();
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

  const asset: ExamAsset = {
    id: assetId,
    filename: assetId,
    mimeType,
    dataUrl,
    base64,
  };

  globalRegistry.set(assetId, asset);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`asset_${assetId}`, dataUrl);
      sessionStorage.setItem(`asset_${assetId}`, dataUrl);
    } catch {}
  }

  return assetId;
}

/**
 * Tra cứu asset theo ID để lấy URL hiển thị
 */
export function getExamAsset(assetId: string): ExamAsset | undefined {
  const clean = assetId.trim();
  const found = globalRegistry.get(clean);
  if (found) return found;
  if (typeof window !== 'undefined') {
    hydrateAssetsFromBrowserStorage();
    return globalRegistry.get(clean);
  }
  return undefined;
}

/**
 * Tra cứu URL hiển thị từ asset ID hoặc trả về chính nó nếu là URL hợp lệ
 */
export function resolveAssetUrl(src: string): string {
  const cleanSrc = src.trim();
  const asset = globalRegistry.get(cleanSrc);
  if (asset) return asset.dataUrl;

  // Nếu chạy trên trình duyệt, tra cứu và đồng bộ từ storage
  if (typeof window !== 'undefined') {
    hydrateAssetsFromBrowserStorage();
    const rechecked = globalRegistry.get(cleanSrc);
    if (rechecked) return rechecked.dataUrl;

    try {
      const localDirect = localStorage.getItem(`asset_${cleanSrc}`);
      if (localDirect) {
        globalRegistry.set(cleanSrc, { id: cleanSrc, filename: cleanSrc, mimeType: '', dataUrl: localDirect, base64: '' });
        return localDirect;
      }
      const sessionDirect = sessionStorage.getItem(`asset_${cleanSrc}`);
      if (sessionDirect) {
        globalRegistry.set(cleanSrc, { id: cleanSrc, filename: cleanSrc, mimeType: '', dataUrl: sessionDirect, base64: '' });
        return sessionDirect;
      }
    } catch {}
  }

  return cleanSrc;
}

/**
 * Lấy tất cả assets hiện có trong Registry (để truyền từ Server về Client)
 */
export function getAllExamAssets(): ExamAsset[] {
  if (typeof window !== 'undefined') {
    hydrateAssetsFromBrowserStorage();
  }
  return Array.from(globalRegistry.values());
}

/**
 * Nạp asset từ ngoài vào Registry (ví dụ Client nhận danh sách asset từ API)
 */
export function setExamAsset(asset: ExamAsset): void {
  if (asset && asset.id) {
    globalRegistry.set(asset.id, asset);
    if (typeof window !== 'undefined' && asset.dataUrl) {
      try {
        localStorage.setItem(`asset_${asset.id}`, asset.dataUrl);
        sessionStorage.setItem(`asset_${asset.id}`, asset.dataUrl);
      } catch {}
    }
  }
}

/**
 * Nạp hàng loạt assets
 */
export function loadExamAssets(assets: ExamAsset[]): void {
  if (!Array.isArray(assets) || assets.length === 0) return;
  for (const a of assets) {
    setExamAsset(a);
  }
  if (typeof window !== 'undefined') {
    try {
      const existing = localStorage.getItem('exam_assets');
      let merged: ExamAsset[] = existing ? JSON.parse(existing) : [];
      if (!Array.isArray(merged)) merged = [];
      for (const a of assets) {
        if (!merged.some((m) => m.id === a.id)) {
          merged.push(a);
        }
      }
      localStorage.setItem('exam_assets', JSON.stringify(merged));
      sessionStorage.setItem('exam_assets', JSON.stringify(merged));
    } catch {}
  }
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
