import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export type AIProvider = 'openai' | 'anthropic' | 'google';
export type OptimizeMode = 'off' | 'auto' | 'manual';

export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
}

export interface AIConfig {
  provider: AIProvider;
  optimizeMode: OptimizeMode;
  providers: {
    openai: ProviderConfig;
    anthropic: ProviderConfig;
    google: ProviderConfig;
  };
}

export interface RolePrompt {
  id: string;
  name: string;
  prompt: string;
  builtIn?: boolean;
}

export interface RoleConfig {
  activeRoleId: string;
  roles: RolePrompt[];
}

export const DEFAULT_PROMPT = `你是一个文字整理助手。用户通过语音输入文字，请：
1. 去除口语填充词和语气词（嗯、啊、那个、就是说、然后等）
2. 适度润色语句，使其更通顺，但必须保持原意
3. 严禁添加、推测、纠正或替换事实、名称、版本号、型号、术语、代码片段、路径、命令等
4. 用户可能在讨论技术、代码或项目，你只需要整理文字，不要解释、分析或回应内容本身
5. 只输出整理后的文字，不要添加任何额外内容

如果原文已经清晰，请原样输出。不要基于“更合理/更常见”的知识去改写用户的内容。`;

const defaultConfig: AIConfig = {
  provider: 'openai',
  optimizeMode: 'off',
  providers: {
    openai: { apiKey: '', model: 'gpt-4o-mini', baseURL: '' },
    anthropic: { apiKey: '', model: 'claude-3-5-haiku-latest', baseURL: '' },
    google: { apiKey: '', model: 'gemini-1.5-flash', baseURL: '' },
  },
};

const defaultRoleConfig: RoleConfig = {
  activeRoleId: 'general',
  roles: [
    {
      id: 'general',
      name: '通用',
      prompt: DEFAULT_PROMPT,
      builtIn: true,
    },
    {
      id: 'developer',
      name: '程序员',
      prompt: `${DEFAULT_PROMPT}\n\n额外要求：\n- 以下术语必须原样保留（区分大小写与符号）：uniapp、Gemini、cloud、ChatGPT\n- 遇到代码、路径、命令、版本号、变量名时严格保持不变`,
      builtIn: true,
    },
    {
      id: 'daily',
      name: '日常工作',
      prompt: `${DEFAULT_PROMPT}\n\n额外要求：\n- 不需要堆砌专业术语，保持简洁清楚\n- 保留人名、组织名、数字、日期、金额`,
      builtIn: true,
    },
  ],
};

function readLegacyCustomPrompt(): string | null {
  try {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) return null;
    const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (typeof saved.customPrompt === 'string' && saved.customPrompt.trim()) {
      return saved.customPrompt.trim();
    }
  } catch (err) {
    console.warn('Failed to read legacy custom prompt:', err);
  }
  return null;
}

let configCache: AIConfig | null = null;
let roleConfigCache: RoleConfig | null = null;
const getConfigPath = () => path.join(app.getPath('userData'), 'ai-config.json');
const getRoleConfigPath = () => path.join(app.getPath('userData'), 'roles.json');

export function loadConfig(): AIConfig {
  if (configCache) return configCache;
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      // Merge with defaults to handle new fields
      configCache = {
        ...defaultConfig,
        ...saved,
        providers: {
          ...defaultConfig.providers,
          ...saved.providers,
        },
      };
      return configCache!;
    }
  } catch (err) {
    console.warn('Failed to load AI config:', err);
  }
  configCache = { ...defaultConfig };
  return configCache;
}

function ensureActiveRole(config: RoleConfig): RoleConfig {
  const hasActive = config.roles.some((role) => role.id === config.activeRoleId);
  if (hasActive) return config;
  return { ...config, activeRoleId: config.roles[0]?.id || 'general' };
}

export function loadRoleConfig(): RoleConfig {
  if (roleConfigCache) return roleConfigCache;
  try {
    const configPath = getRoleConfigPath();
    if (fs.existsSync(configPath)) {
      const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as RoleConfig;
      roleConfigCache = ensureActiveRole({
        ...defaultRoleConfig,
        ...saved,
        roles: Array.isArray(saved.roles) && saved.roles.length > 0 ? saved.roles : defaultRoleConfig.roles,
      });
      return roleConfigCache!;
    }
  } catch (err) {
    console.warn('Failed to load role config:', err);
  }
  const legacyPrompt = readLegacyCustomPrompt();
  roleConfigCache = {
    ...defaultRoleConfig,
    ...(legacyPrompt
      ? {
          activeRoleId: 'custom',
          roles: [
            ...defaultRoleConfig.roles,
            {
              id: 'custom',
              name: '自定义',
              prompt: legacyPrompt,
            },
          ],
        }
      : {}),
  };
  return roleConfigCache;
}

export function saveRoleConfig(config: Partial<RoleConfig>): RoleConfig {
  const current = loadRoleConfig();
  const updated: RoleConfig = {
    ...current,
    ...config,
    roles: config.roles ? config.roles : current.roles,
  };
  roleConfigCache = ensureActiveRole(updated);
  try {
    fs.writeFileSync(getRoleConfigPath(), JSON.stringify(roleConfigCache, null, 2));
  } catch (err) {
    console.warn('Failed to save role config:', err);
  }
  return roleConfigCache;
}

export function saveConfig(config: Partial<AIConfig>): AIConfig {
  const current = loadConfig();
  const updated: AIConfig = {
    ...current,
    ...config,
    providers: config.providers ? { ...current.providers, ...config.providers } : current.providers,
  };
  configCache = updated;
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(updated, null, 2));
  } catch (err) {
    console.warn('Failed to save AI config:', err);
  }
  return updated;
}

export function getConfig(): AIConfig {
  return loadConfig();
}

export function getRoleConfig(): RoleConfig {
  return loadRoleConfig();
}
