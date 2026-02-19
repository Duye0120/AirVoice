import { tool } from 'ai';
import { z } from 'zod';
import { execSync } from 'child_process';
import path from 'path';

const MAX_OUTPUT_BYTES = 50 * 1024;
const MAX_OUTPUT_LINES = 2000;

function truncateTail(text: string): { text: string; truncated: boolean } {
  let result = text;
  let truncated = false;

  const lines = result.split(/\r?\n/);
  if (lines.length > MAX_OUTPUT_LINES) {
    result = lines.slice(lines.length - MAX_OUTPUT_LINES).join('\n');
    truncated = true;
  }

  if (Buffer.byteLength(result, 'utf8') > MAX_OUTPUT_BYTES) {
    while (Buffer.byteLength(result, 'utf8') > MAX_OUTPUT_BYTES && result.length > 0) {
      result = result.slice(1);
    }
    truncated = true;
  }

  return { text: result, truncated };
}

export const bash = tool({
  description: '执行终端命令。返回 stdout 和 stderr。超时 30 秒。',
  inputSchema: z.object({
    command: z.string().describe('要执行的终端命令'),
    cwd: z.string().optional().describe('执行目录，默认当前工作目录'),
  }),
  execute: async ({ command, cwd }) => {
    const workdir = path.resolve(cwd ?? process.cwd());
    console.log(`[tool:bash] ${command}`);

    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      const out = execSync(command, {
        cwd: workdir,
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      stdout = out;
    } catch (error) {
      const execError = error as Error & {
        status?: number;
        stdout?: string | Buffer;
        stderr?: string | Buffer;
      };

      exitCode = typeof execError.status === 'number' ? execError.status : 1;
      stdout = execError.stdout ? String(execError.stdout) : '';
      stderr = execError.stderr ? String(execError.stderr) : execError.message;
    }

    const stdoutTrimmed = truncateTail(stdout);
    const stderrTrimmed = truncateTail(stderr);

    return {
      stdout: stdoutTrimmed.text,
      stderr: stderrTrimmed.text,
      exitCode,
      truncated: stdoutTrimmed.truncated || stderrTrimmed.truncated,
    };
  },
});
