import { BaseProvider } from '@/lib/modules/llm/base-provider';
import type { ModelInfo } from '@/lib/modules/llm/types';
import type { IProviderSetting } from '@/types/model';
import type { LanguageModelV1 } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';

export default class DeepseekProvider extends BaseProvider {
  name = 'Deepseek';
  getApiKeyLink = 'https://platform.deepseek.com/apiKeys';

  config = {
    apiTokenKey: 'DEEPSEEK_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // { name: 'deepseek-coder', label: 'Deepseek-Coder', provider: 'Deepseek', maxTokenAllowed: 8000 },
    // { name: 'deepseek/deepseek-chat', label: 'Deepseek-Chat', provider: 'Deepseek', maxTokenAllowed: 8000 },
    { name: 'deepseek/deepseek-chat-v3-0324', label: 'deepseek-chat-v3-0324', provider: 'Deepseek', maxTokenAllowed: 8000 },
  ];

  getModelInstance(options: {
    model: string;
    serverEnv?: Record<string, string>;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'DEEPSEEK_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const deepseek = createDeepSeek({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    return deepseek(model, {
      // simulateStreaming: true,
    });
  }
}
