import { generateText, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getConfig, getRoleConfig, type AIProvider } from './config';
import { allTools } from './tools/index';
import type { AgentStepInfo, ChatMessage } from './types';

function createModel(provider: AIProvider, apiKey: string, model: string, baseURL?: string) {
  switch (provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey, baseURL: baseURL || undefined });
      return anthropic(model);
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey, baseURL: baseURL || undefined });
      return google(model);
    }
    default: {
      const openai = createOpenAI({
        apiKey,
        baseURL: baseURL || undefined,
      });
      return openai.chat(model);
    }
  }
}

export interface AgentResult {
  text: string;
  steps: AgentStepInfo[];
  /** 最终输入到 PC 的文字（如果有 typeText 调用） */
  typedText?: string;
  /** agent 的回复消息（如果有 reply 调用） */
  replyMessage?: string;
}

const AGENT_SYSTEM_PROMPT = `你是 AirVoice 智能助手，运行在用户的 PC 上。

你有以下能力：

## 文字输入工具
- typeText: 将文字输入到 PC 当前光标位置
- translate: 翻译文字
- formatCode: 格式化代码
- rewrite: 润色/改写文字
- summarize: 总结文字
- reply: 直接回复用户（不输入到 PC）

## 文件系统工具
- readFile: 读取文件内容（支持行号范围）
- writeFile: 写入文件
- editFile: 编辑文件（查找替换）
- listDir: 列出目录内容
- searchContent: 搜索文件内容（grep）
- findFiles: 按名称模式查找文件
- bash: 执行终端命令

## 核心规则

1. **对话模式**：当用户在和你对话（提问、讨论、请求帮助），使用 reply 工具回复。
2. **文件操作**：当用户要求读写文件、搜索代码、执行命令时，使用对应的文件系统工具。
3. **文字输入**：当用户明确要求把文字输入到 PC 光标位置时，使用 typeText。
4. **智能识别**：如果用户的消息包含明确的指令（如"翻译成英文"、"帮我润色"），先执行对应操作，然后根据上下文决定是 reply 还是 typeText。
5. **保持原意**：处理文字时，严禁添加、推测或替换用户的原始内容中的事实、名称、版本号、术语等。
6. **语音输入优化**：用户通过语音输入时，文字可能包含口语填充词（嗯、啊、那个），在 typeText 之前自动清理这些。

## 重要
- 每次只调用必要的工具，不要过度处理
- 工具调用的结果就是最终结果，不需要再用文字重复
- 你可以连续调用多个工具来完成复杂任务`;

export async function runAgent(
  userMessage: string,
  options?: {
    execute?: boolean;
    history?: ChatMessage[];
  },
): Promise<AgentResult> {
  const config = getConfig();
  const providerConfig = config.providers[config.provider];

  if (!providerConfig.apiKey) {
    throw new Error('未配置 API Key');
  }

  const model = createModel(config.provider, providerConfig.apiKey, providerConfig.model, providerConfig.baseURL);
  const roleConfig = getRoleConfig();
  const activeRole = roleConfig.roles.find((role) => role.id === roleConfig.activeRoleId);

  // 构建 system prompt：agent 基础 prompt + 角色自定义 prompt
  let systemPrompt = AGENT_SYSTEM_PROMPT;
  if (activeRole?.prompt?.trim()) {
    systemPrompt += `\n\n## 当前角色：${activeRole.name}\n${activeRole.prompt}`;
  }

  // 如果用户选择了"发送并回车"模式，在 prompt 中提示
  let prompt = userMessage;
  if (options?.execute) {
    prompt += '\n\n[系统提示：用户选择了"发送并回车"模式，如果调用 typeText，请设置 execute=true]';
  }

  // 构建消息历史
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (options?.history?.length) {
    for (const msg of options.history) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
  }
  // 添加当前消息
  messages.push({ role: 'user', content: prompt });

  const agentSteps: AgentStepInfo[] = [];

  const { text } = await generateText({
    model,
    system: systemPrompt,
    tools: allTools,
    stopWhen: stepCountIs(10),
    messages,
    onStepFinish: async ({ toolCalls, toolResults, text: stepText }) => {
      if (toolCalls) {
        for (const call of toolCalls) {
          agentSteps.push({
            type: 'tool-call',
            toolName: call.toolName,
            args: call.input as Record<string, unknown>,
          });
        }
      }
      if (toolResults) {
        for (const result of toolResults) {
          agentSteps.push({
            type: 'tool-result',
            toolName: result.toolName,
            result: result.output,
          });
        }
      }
      if (stepText) {
        agentSteps.push({ type: 'text', text: stepText });
      }
    },
  });

  // 从步骤中提取关键结果
  let typedText: string | undefined;
  let replyMessage: string | undefined;

  for (const step of agentSteps) {
    if (step.type === 'tool-result') {
      const result = step.result as Record<string, unknown> | undefined;
      if (step.toolName === 'typeText' && result?.success) {
        typedText = result.text as string;
      }
      if (step.toolName === 'reply' && result?.success) {
        replyMessage = result.message as string;
      }
    }
  }

  return {
    text: text || '',
    steps: agentSteps,
    typedText,
    replyMessage,
  };
}
