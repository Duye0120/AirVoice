import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

export const listDir = tool({
  description: '列出目录内容。目录名后缀 /，文件显示大小。',
  inputSchema: z.object({
    dirPath: z.string().describe('目录路径，支持绝对路径或相对路径'),
  }),
  execute: async ({ dirPath }) => {
    const resolvedDirPath = path.resolve(dirPath);
    const dirEntries = fs.readdirSync(resolvedDirPath, { withFileTypes: true });

    const entries = dirEntries.map((entry) => {
      const entryPath = path.join(resolvedDirPath, entry.name);
      if (entry.isDirectory()) {
        return `${entry.name}/`;
      }

      const size = fs.statSync(entryPath).size;
      return `${entry.name} (${size} bytes)`;
    });

    return {
      entries,
      count: entries.length,
    };
  },
});
