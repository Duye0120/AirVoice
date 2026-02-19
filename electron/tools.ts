import { tool } from 'ai';
import { z } from 'zod';
import { typeText } from './keyboard';

/**
 * Agent 工具集
 * 每个工具都是一个独立的能力，AI 根据用户意图自动选择调用
 */

export const agentTools = {
  /** 将文字输入到 PC 当前光标位置 */
  typeText: tool({
    description: '将处理后的文字输入到 PC 当前光标位置。当用户想要把文字发送到电脑时调用此工具。',
    inputSchema: z.object({
      text: z.string().describe('要输入的文字'),
      execute: z.boolean().optional().describe('输入后是否按回车键（适用于终端命令）'),
    }),
    execute: async ({ text, execute }) => {
      typeText(text, execute);
      return { success: true, text };
    },
  }),

  /** 翻译文字 */
  translate: tool({
    description: '将文字翻译成目标语言。当用户的输入包含翻译意图时调用（如"翻译成英文"、"translate to Chinese"）。',
    inputSchema: z.object({
      text: z.string().describe('翻译后的文字'),
      from: z.string().describe('源语言'),
      to: z.string().describe('目标语言'),
    }),
    execute: async ({ text, from, to }) => {
      return { success: true, text, from, to };
    },
  }),

  /** 格式化代码 */
  formatCode: tool({
    description: '格式化或整理代码片段。当用户输入的内容是代码，或用户要求格式化代码时调用。',
    inputSchema: z.object({
      code: z.string().describe('格式化后的代码'),
      language: z.string().optional().describe('编程语言'),
    }),
    execute: async ({ code, language }) => {
      return { success: true, code, language };
    },
  }),

  /** 润色/改写文字 */
  rewrite: tool({
    description: '润色、改写或优化文字表达。当用户想要改善文字质量、使其更正式/更口语化/更简洁时调用。',
    inputSchema: z.object({
      text: z.string().describe('改写后的文字'),
      style: z.string().optional().describe('改写风格，如：正式、口语、简洁、详细'),
    }),
    execute: async ({ text, style }) => {
      return { success: true, text, style };
    },
  }),

  /** 总结文字 */
  summarize: tool({
    description: '总结或提炼文字要点。当用户想要缩短内容、提取关键信息时调用。',
    inputSchema: z.object({
      summary: z.string().describe('总结后的文字'),
    }),
    execute: async ({ summary }) => {
      return { success: true, summary };
    },
  }),

  /** 直接回复用户（不输入到 PC） */
  reply: tool({
    description: '直接回复用户的问题或请求，不将内容输入到 PC。当用户在提问、闲聊、或需要信息而不是输入文字时调用。',
    inputSchema: z.object({
      message: z.string().describe('回复内容'),
    }),
    execute: async ({ message }) => {
      return { success: true, message };
    },
  }),
};

export type AgentToolName = keyof typeof agentTools;
