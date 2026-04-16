// ============================================================
// OpenAI-Compatible Provider
// Works with OpenAI API, LM Studio, and any OpenAI-compatible endpoint
// ============================================================

import type { NormalizedIssueInput } from '../models/jira';
import type { UserStoryResult } from '../models/story';
import type { LLMProvider, LLMProviderConfig } from './types';
import { buildPromptMessages } from './prompt-template';

/**
 * OpenAI Chat Completions API response shape (subset).
 */
interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Provider for any OpenAI-compatible Chat Completions API.
 *
 * This covers:
 * - OpenAI (https://api.openai.com/v1)
 * - LM Studio (http://127.0.0.1:1234/v1)
 * - Azure OpenAI, Together AI, Groq, etc.
 */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly name = 'OpenAI Compatible';
  private readonly config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  async generate(input: NormalizedIssueInput): Promise<UserStoryResult> {
    const messages = buildPromptMessages(input);
    const url = this.buildUrl();
    const headers = this.buildHeaders();

    const body = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 2048,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to connect to LLM provider at ${this.config.baseUrl}. ` +
        `Make sure the server is running and accessible.\n\nDetails: ${message}`,
      );
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'No response body');
      throw new Error(
        `LLM API returned ${response.status} ${response.statusText}.\n\n${errorBody}`,
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new Error('LLM API returned an empty response (no choices).');
    }

    const content = data.choices[0].message.content;
    if (!content || content.trim().length === 0) {
      throw new Error('LLM API returned an empty message content.');
    }

    return {
      raw: content.trim(),
      generatedAt: Date.now(),
      issueKey: input.issueKey,
      provider: this.name,
      model: this.config.model,
    };
  }

  private buildUrl(): string {
    const base = this.config.baseUrl.replace(/\/+$/, '');
    return `${base}/chat/completions`;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // LM Studio accepts the Authorization header but doesn't require a real key.
    // We send it anyway for compatibility.
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }
}
