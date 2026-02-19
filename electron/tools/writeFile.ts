import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

function isSensitiveFile(filePath: string): boolean {
  const fileName = path.basename(filePath).toLowerCase();
  return ['.env', 'credentials', 'secret', 'password'].some((keyword) => fileName.includes(keyword));
}

export const writeFile = tool({
  description: '创建或覆盖文件内容。自动创建父目录。',
  inputSchema: z.object({
    filePath: z.string().describe('文件路径，支持绝对路径或相对路径'),
    content: z.string().describe('要写入的文件内容'),
  }),
  execute: async ({ filePath, content }) => {
    const resolvedPath = path.resolve(filePath);

    if (isSensitiveFile(resolvedPath)) {
      throw new Error('Access denied: sensitive file is blocked');
    }

    const parentDir = path.dirname(resolvedPath);
    fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(resolvedPath, content, 'utf8');

    return {
      success: true,
      filePath: resolvedPath,
      bytesWritten: Buffer.byteLength(content, 'utf8'),
    };
  },
});
