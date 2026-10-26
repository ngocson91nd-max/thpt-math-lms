-- Cho phép khách và học sinh chưa đăng nhập xem danh sách lớp, khóa học, đề thi và câu hỏi công khai
ALTER POLICY "Xem lớp học" ON public.classes TO authenticated, anon;
ALTER POLICY "Xem khóa học" ON public.courses TO authenticated, anon;
ALTER POLICY "Xem chương" ON public.chapters TO authenticated, anon;
ALTER POLICY "Xem bài học" ON public.lessons TO authenticated, anon;
ALTER POLICY "Xem câu hỏi Toán" ON public.questions TO authenticated, anon;
ALTER POLICY "Xem đề thi" ON public.exams TO authenticated, anon;
ALTER POLICY "Xem câu hỏi trong đề" ON public.exam_questions TO authenticated, anon;
ALTER POLICY "Xem học liệu" ON public.materials TO authenticated, anon;
ALTER POLICY "Cho phép mọi người dùng đã đăng nhập đọc profiles" ON public.profiles TO authenticated, anon;
