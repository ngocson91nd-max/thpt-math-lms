function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Thiếu ${name}. Tạo .env.security từ 'supabase status'.`);
  return v;
}

export const env = {
  url: need('SUPABASE_URL'),
  anon: need('SUPABASE_ANON_KEY'),
  service: need('SUPABASE_SERVICE_ROLE_KEY'),
  db: need('DATABASE_URL'),
  app: process.env.APP_URL ?? 'http://localhost:3000',
};

// CHỐT AN TOÀN: tuyệt đối không chạy (đặc biệt là mutation) trên database thật
const LOCAL = new Set(['127.0.0.1', 'localhost']);
for (const [name, value] of [['SUPABASE_URL', env.url], ['DATABASE_URL', env.db]] as const) {
  const host = new URL(value).hostname;
  if (!LOCAL.has(host)) {
    throw new Error(`TỪ CHỐI CHẠY: ${name} trỏ tới ${host}, không phải máy cục bộ.`);
  }
}
