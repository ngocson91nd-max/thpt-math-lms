-- Migration: 20261026000004_auto_confirm_users.sql
-- Mô tả: Tự động kích hoạt (Confirm) Email cho mọi học sinh đăng ký, không cần mở hòm thư xác thực

-- 1. Hàm tự động xác nhận email cho user mới trong auth.users
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Tự động đánh dấu email đã xác thực ngay khi tài khoản được tạo
  NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Gắn trigger BEFORE INSERT vào bảng auth.users
DROP TRIGGER IF EXISTS on_auth_user_before_insert ON auth.users;
CREATE TRIGGER on_auth_user_before_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_new_user();

-- 3. Cập nhật toàn bộ các tài khoản học sinh đã đăng ký trước đó nhưng chưa xác nhận email
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;
