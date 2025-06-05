// app/api/llmcall/route.ts
import { NextResponse } from 'next/server';
import { streamText } from '@/lib/.server/llm/stream-text';
import type { IProviderSetting, ProviderInfo } from '@/types/model';
import { generateText } from 'ai';
import { PROVIDER_LIST } from '@/utils/constants';
import { MAX_TOKENS } from '@/lib/.server/llm/constants';
import { LLMManager } from '@/lib/modules/llm/manager';
import type { ModelInfo } from '@/lib/modules/llm/types';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '@/lib/api/cookies';
import { createScopedLogger } from '@/utils/logger';
import { auth } from "auth"


const logger = createScopedLogger('api.llmcall');

export const runtime = 'edge';

async function getModelList(options: {
  apiKeys?: Record<string, string>;
  providerSettings?: Record<string, IProviderSetting>;
  serverEnv?: Record<string, string>;
}) {
  const llmManager = LLMManager.getInstance(); // Adjusted for Next.js env
  return llmManager.updateModelList(options);
}

export async function POST(request: Request) {
  const { system, message, model, provider, streamOutput } = await request.json() as {
    system: string;
    message: string;
    model: string;
    provider: ProviderInfo;
    streamOutput?: boolean;
  };

  const session = await auth();
  if (!session) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const { name: providerName } = provider;

  // Validate 'model' and 'provider' fields
  if (!model || typeof model !== 'string') {
    return new Response('Invalid or missing model', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  if (!providerName || typeof providerName !== 'string') {
    return new Response('Invalid or missing provider', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettings = getProviderSettingsFromCookie(cookieHeader);
  const env = process.env as Record<string, string>; // Adjusted for Next.js env

  if (streamOutput) {
    try {
      const result = await streamText({
        options: {
          system,
        },
        messages: [
          {
            role: 'user',
            content: `${message}`,
          },
        ],
        env,
        apiKeys,
        providerSettings,
      });

      return new Response(result.textStream, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    } catch (error: unknown) {
      console.log(error);

      if (error instanceof Error && error.message?.includes('API key')) {
        return new Response('Invalid or missing API key', {
          status: 401,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      return new Response(null, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  } else {
    try {
      const models = await getModelList({ apiKeys, providerSettings, serverEnv: env });
      const modelDetails = models.find((m: ModelInfo) => m.name === model);

      if (!modelDetails) {
        throw new Error('Model not found');
      }

      const dynamicMaxTokens = modelDetails && modelDetails.maxTokenAllowed ? modelDetails.maxTokenAllowed : MAX_TOKENS;

      const providerInfo = PROVIDER_LIST.find((p) => p.name === provider.name);

      if (!providerInfo) {
        throw new Error('Provider not found');
      }

      logger.info(`Generating response Provider: ${provider.name}, Model: ${modelDetails.name}`);

      const result = await generateText({
        system,
        messages: [
          {
            role: 'user',
            content: `${message}`,
          },
        ],
        model: providerInfo.getModelInstance({
          model: 'deepseek/deepseek-chat', // 强制使用 deepseek-chat 模型
          serverEnv: env,
          apiKeys,
          providerSettings,
        }),
        maxTokens: dynamicMaxTokens,
        toolChoice: 'none',
      });
      logger.info(`Generated response`);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error: unknown) {
      console.log(error);

      if (error instanceof Error && error.message?.includes('API key')) {
        return new Response('Invalid or missing API key', {
          status: 401,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      return new Response(null, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  }
}