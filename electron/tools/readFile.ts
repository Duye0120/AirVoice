import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const MAX_OUTPUT_BYTES = 50 * 1024;

function isSensitiveFile(filePath: string): boolean {
  const fileName = path.basename(filePath).toLowerCase();
  return ['.env', 'credentials', 'secret', 'password'].some((keyword) => fileName.includes(keyword));
}

function truncateByBytes(text: string, maxBytes: number): { text: string; truncated: boolean } {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) {
    return { text, truncated: false };
  }

  let result = text;
  while (Buffer.byteLength(result, 'utf8') > maxBytes && result.length > 0) {
    result = result.slice(0, -1);
  }

  return { text: result, truncated: true };
}

export const readFile = tool({
  description: '读取文件内容。支持指定行号范围。',
  inputSchema: z.object({
    filePath: z.string().describe('文件路径，支持绝对路径或相对路径'),
    offset: z.number().int().min(1).optional().describe('从第几行开始读取（1-indexed）'),
    limit: z.number().int().min(1).optional().describe('最多读取多少行，默认 200'),
  }),
  execute: async ({ filePath, offset = 1, limit = 200 }) => {
    const resolvedPath = path.resolve(filePath);

    if (isSensitiveFile(resolvedPath)) {
      throw new Error('Access denied: sensitive file is blocked');
    }

    const content = fs.readFileSync(resolvedPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const startIndex = offset - 1;
    const selectedLines = lines.slice(startIndex, startIndex + limit);

    const numbered = selectedLines
      .map((line, index) => `${startIndex + index + 1}: ${line}`)
      .join('\n');

    const truncated = truncateByBytes(numbered, MAX_OUTPUT_BYTES);

    return {
      content: truncated.text,
      totalLines: lines.length,
      truncated: truncated.truncated,
    };
  },
});
