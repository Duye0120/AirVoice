import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist']);

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const withStars = escaped.replace(/\*\*/g, '___DOUBLE_STAR___').replace(/\*/g, '[^/]*').replace(/___DOUBLE_STAR___/g, '.*');
  return new RegExp(`^${withStars}$`);
}

export const findFiles = tool({
  description: '按文件名或 glob 模式查找文件。',
  inputSchema: z.object({
    pattern: z.string().describe('文件名或 glob 模式（支持 * 和 **）'),
    dirPath: z.string().optional().describe('查找根目录，默认当前工作目录'),
    maxResults: z.number().int().min(1).optional().describe('最多返回结果数，默认 50'),
  }),
  execute: async ({ pattern, dirPath, maxResults = 50 }) => {
    const rootDir = path.resolve(dirPath ?? process.cwd());
    const matcher = globToRegExp(pattern.replace(/\\/g, '/'));
    const files: string[] = [];
    let truncated = false;

    function walk(currentDir: string): void {
      if (truncated) {
        return;
      }

      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (truncated) {
          return;
        }

        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name)) {
            walk(fullPath);
          }
          continue;
        }

        if (matcher.test(entry.name) || matcher.test(relativePath)) {
          files.push(fullPath);
          if (files.length >= maxResults) {
            truncated = true;
            return;
          }
        }
      }
    }

    walk(rootDir);

    return {
      files,
      count: files.length,
      truncated,
    };
  },
});
