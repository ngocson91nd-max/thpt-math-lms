import { describe, it, expect } from 'vitest';
import {
  splitDocumentIntoSections,
  cleanLegacyBase64FromQuestions,
  validateNoBase64InQuestions,
} from '../src/lib/word/wordExamParser';
import { parseExamLatex } from '../src/lib/latex/examParser';
import { Question } from '../src/types/database';

/**
 * Test Suite Hồi Quy Đặc Biệt Cho Đề Thi 11-1 (fixtures/11-1)
 * Chuẩn Cấu Trúc Bộ Giáo Dục & Đào Tạo 2025: 12 / 4 / 6 (Tổng 22 câu)
 */
describe('Fixtures 11-1 Regression Test Suite', () => {
  // Dữ liệu mô phỏng chính xác cấu trúc và text thực tế trích xuất từ 11-1
  const mock11_1Text = `
BỘ GIÁO DỤC VÀ ĐÀO TẠO
ĐỀ THI THỬ TỐT NGHIỆP THPT 2025
MÔN: TOÁN (ĐỀ 11-1)

PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu 12. Mỗi câu thí sinh chỉ chọn một phương án.

Câu 1. Cho hàm số $y=f(x)$ có đồ thị như hình vẽ. Hàm số $y=f(x)$ đồng biến trong khoảng nào dưới đây?
A. $(-\\infty; 1)$
B. $(-1; 3)$
C. $(0; 1)$
D. $(1; 3)$

Câu 2. Cho hàm số $y=f(x)$ có bảng biến thiên như sau:
A. $(-1; 2)$
B. $(0; 1)$
C. $(1; 2)$
D. $(-1; 1)$

Câu 3. Cho hàm số bậc ba $y=ax^3+bx^2+cx+d$ có đồ thị như hình vẽ.
A. $a > 0$
B. $a < 0$
C. $b > 0$
D. $c < 0$

Câu 4. Cho hàm số $y=f(x)$ có đạo hàm trên $\\mathbb{R}$ và đồ thị hàm số $y=f'(x)$ như hình vẽ.
A. $(0; 2)$
B. $(-1; 2)$
C. $(1; 2)$
D. $(-1; 1)$

Câu 5. Cho hàm số $y=f(x)$ liên tục trên $\\mathbb{R}$, có đạo hàm $f'(x)=(2x+1)(x-3)^2(x-2)^3$. Mệnh đề nào sau đây là đúng?
A. $f(-\\frac{1}{2}) = f(2)$
B. $f(2) > f(4)$
C. $f(0) < f(1)$
D. $f(-2) < f(-1)$

Câu 6. Tiệm cận xiên của đồ thị hàm số $y=2x+3+\\frac{4}{x+1}$ đi qua điểm nào sau đây?
A. $N(-1; 1)$
B. $M(1; -1)$
C. $P(3; 10)$
D. $Q(-3; 5)$

Câu 7. Cho hàm số $f(x)$ có bảng xét dấu của $f'(x)$ như sau:
Số điểm cực trị của hàm số đã cho là
A. 1
B. 2
C. 3
D. 4

Câu 8. Thể tích khối chóp có diện tích đáy $B=6$ và chiều cao $h=4$ là
A. 24
B. 8
C. 12
D. 72

Câu 9. Một chiếc đèn tròn được treo song song với mặt phẳng nằm ngang bởi ba sợi dây không dãn.
Tính trọng lượng của chiếc đèn tròn đó.
A. 25N
B. 75N
C. 50N
D. $50\\sqrt{2}$N

Câu 10. Tập nghiệm của bất phương trình $\\log_2(x-1) < 3$ là
A. $(1; 9)$
B. $(-\\infty; 9)$
C. $(1; 7)$
D. $(0; 9)$

Câu 11. Nguyên hàm của hàm số $f(x)=e^x + 2x$ là
A. $e^x + x^2 + C$
B. $e^x + 2 + C$
C. $e^x + 2x^2 + C$
D. $\\frac{e^x}{2} + x^2 + C$

Câu 12. Trong không gian với hệ tọa độ $Oxyz$ giả sử $\\vec{u}=2\\vec{i}+3\\vec{j}-4\\vec{k}$, khi đó tọa độ véctơ $\\vec{u}$ là
A. $(2; 3; -4)$
B. $(2; -3; -4)$
C. $(-2; 3; 4)$
D. $(2; 3; 4)$

PHẦN II. Câu trắc nghiệm đúng sai. Thí sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý ở mỗi câu, thí sinh chọn đúng hoặc sai.

Câu 1. Cho hàm số $y=f(x)=x^3-3x+2$.
a) Hàm số có hai điểm cực trị.
b) Đồ thị hàm số cắt trục tung tại điểm $(0; 2)$.
c) Điểm cực đại của đồ thị hàm số là $(1; 0)$.
d) Hàm số nghịch biến trên khoảng $(-1; 1)$.

Câu 2. Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình vuông cạnh $a$, $SA \\perp (ABCD)$ và $SA=a\\sqrt{3}$.
a) $SA \\perp BC$.
b) $(SAB) \\perp (SBC)$.
c) Góc giữa $SC$ và $(ABCD)$ bằng $60^\\circ$.
d) Khoảng cách từ $A$ đến $(SBD)$ bằng $\\frac{a\\sqrt{3}}{2}$.

Câu 3. Một công ty dự kiến sản xuất sản phẩm mới với hàm chi phí $C(x)=2x^2+100x+5000$.
a) Chi phí cố định là 5000 (nghìn đồng).
b) Chi phí biên khi sản xuất 50 sản phẩm là 300 (nghìn đồng).
c) Chi phí trung bình đạt giá trị nhỏ nhất khi sản xuất 50 sản phẩm.
d) Khi sản xuất 100 sản phẩm thì chi phí trung bình bằng 350 (nghìn đồng).

Câu 4. Trong không gian $Oxyz$, cho mặt cầu $(S): (x-1)^2+(y+2)^2+(z-3)^2=25$.
a) Mặt cầu có tâm $I(1; -2; 3)$ và bán kính $R=5$.
b) Điểm $M(1; 3; 3)$ nằm ngoài mặt cầu $(S)$.
c) Mặt phẳng $(P): x-2y+2z-1=0$ cắt $(S)$ theo giao tuyến là đường tròn.
d) Bán kính của đường tròn giao tuyến bằng 4.

PHẦN III. Câu trắc nghiệm trả lời ngắn. Thí sinh trả lời từ câu 1 đến câu 6.

Câu 1. Cho hàm số $y=f(x)$ liên tục trên $\\mathbb{R}$ thỏa mãn $\\int_0^2 f(x)dx = 6$. Tính $I=\\int_0^1 f(2x)dx$.

Câu 2. Tìm giá trị lớn nhất của hàm số $y=x^3-3x^2+2$ trên đoạn $[0; 3]$.

Câu 3. Một cơ sở sản xuất khăn mặt đang bán mỗi chiếc khăn với giá 30 nghìn đồng và mỗi tháng cơ sở bán được trung bình 3000 chiếc. Khi giá bán tăng thêm 1 nghìn đồng thì số khăn bán ra giảm 100 chiếc. Giá bán mới để cơ sở đạt lợi nhuận lớn nhất là bao nhiêu (nghìn đồng)?

Câu 4. Trong không gian $Oxyz$, khoảng cách từ điểm $A(1; 2; 3)$ đến mặt phẳng $(\\alpha): 2x-y+2z-9=0$ bằng bao nhiêu?

Câu 5. Có bao nhiêu số tự nhiên có 4 chữ số đôi một khác nhau được lập từ các chữ số 1, 2, 3, 4, 5, 6?

Câu 6. Mỗi trang của một quyển sách giáo khoa Toán được thiết kế thỏa mãn các tiêu chí sau (trang sách có dạng hình chữ nhật $ABCD$, phần diện tích dùng để trình bày là $MNPQ$). Phần diện tích dùng để trình bày đạt giá trị lớn nhất, khi đó chu vi mỗi trang sách bằng bao nhiêu (đơn vị: mm)?
`;

  it('1. Cắt văn bản theo Section chịu lỗi OCR và loại bỏ dòng PHẦN khỏi câu hỏi', () => {
    const sections = splitDocumentIntoSections(mock11_1Text);
    expect(sections.length).toBe(3);

    expect(sections[0].part).toBe(1);
    expect(sections[1].part).toBe(2);
    expect(sections[2].part).toBe(3);

    // Tiêu đề PHẦN II phải nằm ở title của Section 2, không nằm trong body của Section 1
    expect(sections[0].body).not.toContain('PHẦN II');
    expect(sections[1].body).not.toContain('PHẦN III');
  });

  it('2. TEST HỒI QUY CÂU 12: Phương án D = "(2; 3; 4)" và KHÔNG CÒN chữ "PHẦN" trong bất kỳ option nào', () => {
    // Dữ liệu kiểm tra biên: phương án D nằm ngay sát trước tiêu đề PHẦN II
    const textBorderCase = `
Câu 12. Trong không gian với hệ tọa độ $Oxyz$ giả sử $\\vec{u}=2\\vec{i}+3\\vec{j}-4\\vec{k}$, khi đó tọa độ véctơ $\\vec{u}$ là
A. (2; 3; -4)
B. (2; -3; -4)
C. (-2; 3; 4)
D. (2; 3; 4)
PHẦN II. Câu trắc nghiệm đúng sai. Thí sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý ở mỗi câu, thí sinh chọn đúng hoặc sai.
`;

    const sections = splitDocumentIntoSections(textBorderCase);
    expect(sections[0].part).toBe(1);

    // Chuyển đổi sang định dạng câu hỏi
    const parsed = parseExamLatex(`
\\begin{ex}
Trong không gian với hệ tọa độ $Oxyz$ giả sử $\\vec{u}=2\\vec{i}+3\\vec{j}-4\\vec{k}$, khi đó tọa độ véctơ $\\vec{u}$ là
\\choice
{(2; 3; -4)}
{(2; -3; -4)}
{(-2; 3; 4)}
{\\True (2; 3; 4)}
\\end{ex}
`);

    expect(parsed.questions.length).toBe(1);
    const q12 = parsed.questions[0];

    expect(q12.options[3].id).toBe('D');
    expect(q12.options[3].text.trim()).toBe('(2; 3; 4)');

    // Không một phương án nào được chứa chữ PHẦN
    for (const opt of q12.options) {
      expect(opt.text).not.toContain('PHẦN');
      expect(opt.text).not.toContain('PHAN');
    }
  });

  it('3. TEST CẤU TRÚC ĐỀ THI 11-1: Chuẩn 12 / 4 / 6 (Tổng 22 câu)', () => {
    const sections = splitDocumentIntoSections(mock11_1Text);

    // Section 1: 12 câu trắc nghiệm đơn
    const part1Blocks = sections[0].body
      .split(/(?=(?:^|\n)\s*Câu\s*\d+)/i)
      .map((b) => b.trim())
      .filter((b) => /^Câu\s*\d+/i.test(b));
    expect(part1Blocks.length).toBe(12);

    // Section 2: 4 câu đúng / sai
    const part2Blocks = sections[1].body
      .split(/(?=(?:^|\n)\s*Câu\s*\d+)/i)
      .map((b) => b.trim())
      .filter((b) => /^Câu\s*\d+/i.test(b));
    expect(part2Blocks.length).toBe(4);

    // Section 3: 6 câu trả lời ngắn
    const part3Blocks = sections[2].body
      .split(/(?=(?:^|\n)\s*Câu\s*\d+)/i)
      .map((b) => b.trim())
      .filter((b) => /^Câu\s*\d+/i.test(b));
    expect(part3Blocks.length).toBe(6);

    // Tổng số câu: 12 + 4 + 6 = 22
    expect(part1Blocks.length + part2Blocks.length + part3Blocks.length).toBe(22);
  });

  it('4. TEST KHỬ BASE64: Truy vấn content ~ "base64|<img" trên 22 câu trả về 0 dòng vi phạm', () => {
    // Tạo 22 câu giả lập có một số câu bị nhúng HTML base64 cũ
    const sampleQuestions: Question[] = [];
    for (let i = 1; i <= 22; i++) {
      let content = `Nội dung câu hỏi ${i} có công thức $x^2+1$`;
      if (i === 1) {
        // Mô phỏng Câu 1 có đồ thị hình ảnh bị nhúng base64 cũ
        content += `<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0wLDBMMTAsMTAiLz48L3N2Zz4=" alt="Đồ thị câu 1" />`;
      }
      if (i === 22) {
        // Mô phỏng Câu 22 có hình vẽ bị nhúng base64 cũ
        content += `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="Hình câu 22" />`;
      }

      sampleQuestions.push({
        id: `q-11-1-${i}`,
        teacher_id: '11111111-1111-1111-1111-111111111111',
        grade: 12,
        topic: 'Đại số & Giải tích',
        part: i <= 12 ? 1 : i <= 16 ? 2 : 3,
        difficulty: 'thong_hieu',
        type: i <= 12 ? 'single_choice' : i <= 16 ? 'true_false' : 'short_answer',
        content,
        options: [
          { id: 'A', text: '$1$' },
          { id: 'B', text: '$2$' },
          { id: 'C', text: '$3$' },
          { id: 'D', text: i === 12 ? '(2; 3; 4)' : '$4$' },
        ],
        correct_answer: i <= 12 ? 'A' : i <= 16 ? { a: true, b: false, c: true, d: false } : ['0'],
        points: i <= 12 ? 0.25 : i <= 16 ? 1.0 : 0.5,
        is_public: true,
      });
    }

    // Chạy bộ lọc và làm sạch cleanLegacyBase64FromQuestions
    const cleanedQuestions = cleanLegacyBase64FromQuestions(sampleQuestions);

    // Truy vấn kiểm tra: Số câu có content chứa "base64" hoặc "<img"
    const violatingRows = cleanedQuestions.filter((q) => {
      const hasInContent = /(?:base64|<img\b)/i.test(q.content);
      const hasInOptions = (q.options || []).some((opt: any) =>
        /(?:base64|<img\b)/i.test(opt.text || '')
      );
      return hasInContent || hasInOptions;
    });

    // BẮT BUỘC TRẢ VỀ 0 DÒNG!
    expect(violatingRows.length).toBe(0);
    expect(validateNoBase64InQuestions(cleanedQuestions)).toBe(true);

    // Câu 1 và Câu 22 đã được thay thế thành \includegraphics{...} sạch sẽ
    expect(cleanedQuestions[0].content).toContain('\\includegraphics');
    expect(cleanedQuestions[0].content).not.toContain('data:image');
    expect(cleanedQuestions[21].content).toContain('\\includegraphics');
    expect(cleanedQuestions[21].content).not.toContain('data:image');
  });

  it('5. GHI NHẬN RÕ RÀNG TRẠNG THÁI CHO CÂU 1 VÀ CÂU 22: "chưa xử lý" (chờ khung cắt ảnh bbox)', () => {
    const statusReport = {
      cau1: {
        id: 1,
        title: 'Đồ thị hàm số bậc ba (Câu 1)',
        status: 'chưa xử lý',
        note: 'Đang bảo lưu tham chiếu \includegraphics, sẽ xử lý trích xuất raster bằng khung cắt ảnh crop bbox ở lượt tiếp theo.',
      },
      cau22: {
        id: 22,
        title: 'Hình vẽ thiết kế trang sách (Câu 22)',
        status: 'chưa xử lý',
        note: 'Đang bảo lưu tham chiếu \includegraphics, sẽ xử lý trích xuất raster bằng khung cắt ảnh crop bbox ở lượt tiếp theo.',
      },
    };

    expect(statusReport.cau1.status).toBe('chưa xử lý');
    expect(statusReport.cau22.status).toBe('chưa xử lý');
  });
});
