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

function isTextFile(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
    fs.closeSync(fd);

    for (let i = 0; i < bytesRead; i += 1) {
      if (buffer[i] === 0) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

type SearchMatch = { file: string; line: number; content: string };

export const searchContent = tool({
  description: '在文件中搜索文本内容（类似 grep）。支持正则表达式。',
  inputSchema: z.object({
    pattern: z.string().describe('要搜索的正则表达式模式'),
    dirPath: z.string().optional().describe('搜索根目录，默认当前工作目录'),
    include: z.string().optional().describe('可选 glob 过滤，例如 *.ts'),
    maxResults: z.number().int().min(1).optional().describe('最多返回结果数，默认 50'),
  }),
  execute: async ({ pattern, dirPath, include, maxResults = 50 }) => {
    const rootDir = path.resolve(dirPath ?? process.cwd());
    const includeMatcher = include ? globToRegExp(include.replace(/\\/g, '/')) : null;
    const regex = new RegExp(pattern);

    const matches: SearchMatch[] = [];
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

        if (includeMatcher && !includeMatcher.test(relativePath) && !includeMatcher.test(entry.name)) {
          continue;
        }

        if (!isTextFile(fullPath)) {
          continue;
        }

        let content: string;
        try {
          content = fs.readFileSync(fullPath, 'utf8');
        } catch {
          continue;
        }

        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
          regex.lastIndex = 0;
          if (regex.test(lines[i])) {
            matches.push({
              file: fullPath,
              line: i + 1,
              content: lines[i],
            });
            if (matches.length >= maxResults) {
              truncated = true;
              return;
            }
          }
        }
      }
    }

    walk(rootDir);

    return {
      matches,
      totalMatches: matches.length,
      truncated,
    };
  },
});
