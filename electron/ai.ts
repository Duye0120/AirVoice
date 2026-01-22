import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { getConfig, getRoleConfig, DEFAULT_PROMPT, type AIProvider } from './config';

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
      // 使用 .chat() 强制走 /chat/completions 端点，兼容第三方代理
      return openai.chat(model);
    }
  }
}

export async function optimizeText(text: string): Promise<string> {
  const config = getConfig();
  const providerConfig = config.providers[config.provider];
  
  if (!providerConfig.apiKey || config.optimizeMode === 'off') {
    return text;
  }

  try {
    const model = createModel(config.provider, providerConfig.apiKey, providerConfig.model, providerConfig.baseURL);
    const roleConfig = getRoleConfig();
    const activeRole = roleConfig.roles.find((role) => role.id === roleConfig.activeRoleId);
    const systemPrompt = activeRole?.prompt?.trim() || DEFAULT_PROMPT;
    const { text: optimized } = await generateText({
      model,
      system: systemPrompt,
      prompt: text,
    });
    return optimized || text;
  } catch (err) {
    console.warn('AI optimize failed:', err);
    return text;
  }
}
