import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseWordDocx } from '../src/lib/word/wordExamParser';

describe('Word Exam Parser', () => {
  it('loads tables.docx without throwing', async () => {
    const buffer = fs.readFileSync('node_modules/mammoth/test/test-data/tables.docx');
    const result = await parseWordDocx(buffer);
    expect(result).toBeDefined();
    expect(typeof result.rawText).toBe('string');
  });
});
