-- Migration: 20261026000003_auth_profiles_trigger.sql
-- Mô tả: Trigger tự động tạo profile khi học sinh/giáo viên đăng ký qua Supabase Auth + RLS Policy cho Profiles

-- 1. Cho phép người dùng đã xác thực tự tạo profile của mình nếu trigger chưa chạy
DROP POLICY IF EXISTS "Cho phép người dùng tạo profile của mình" ON public.profiles;
CREATE POLICY "Cho phép người dùng tạo profile của mình"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 2. Hàm trigger tự động tạo Profile khi có tài khoản mới trong auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    grade,
    school_name,
    phone
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE((NEW.raw_user_meta_data->>'grade')::integer, 12),
    COALESCE(NEW.raw_user_meta_data->>'school_name', 'THPT Chuyên'),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    grade = COALESCE(EXCLUDED.grade, public.profiles.grade),
    school_name = COALESCE(EXCLUDED.school_name, public.profiles.school_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Gắn trigger vào bảng auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Bổ sung policy cho khách xem danh sách giáo viên hoặc thông tin công khai
DROP POLICY IF EXISTS "Cho phép khách xem profile cơ bản" ON public.profiles;
CREATE POLICY "Cho phép khách xem profile cơ bản"
ON public.profiles FOR SELECT
TO anon
USING (true);
