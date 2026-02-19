import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

export const editFile = tool({
  description: '精确替换文件中的字符串。用于修改文件的特定部分。',
  inputSchema: z.object({
    filePath: z.string().describe('文件路径，支持绝对路径或相对路径'),
    oldString: z.string().describe('待替换的原始字符串（必须唯一）'),
    newString: z.string().describe('替换后的新字符串'),
  }),
  execute: async ({ filePath, oldString, newString }) => {
    if (oldString.length === 0) {
      throw new Error('oldString not found');
    }

    const resolvedPath = path.resolve(filePath);
    const content = fs.readFileSync(resolvedPath, 'utf8');

    let count = 0;
    let cursor = 0;
    while (true) {
      const index = content.indexOf(oldString, cursor);
      if (index === -1) {
        break;
      }
      count += 1;
      cursor = index + oldString.length;
      if (count > 1) {
        break;
      }
    }

    if (count === 0) {
      throw new Error('oldString not found');
    }
    if (count > 1) {
      throw new Error('Found multiple matches, provide more context');
    }

    const updated = content.replace(oldString, newString);
    fs.writeFileSync(resolvedPath, updated, 'utf8');

    return {
      success: true,
      filePath: resolvedPath,
    };
  },
});
