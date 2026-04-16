// ============================================================
// Provider Types — LLM provider abstraction
// ============================================================

import type { NormalizedIssueInput } from '../models/jira';
import type { UserStoryResult } from '../models/story';

/**
 * Supported provider types.
 * 'openai-compatible' covers OpenAI, LM Studio, and any other
 * service that implements the OpenAI Chat Completions API.
 *
 * Add new discriminators here when supporting non-OpenAI-compatible
 * APIs (e.g., 'anthropic', 'google-genai').
 */
export type ProviderType = 'openai-compatible';

/**
 * Configuration for an LLM provider.
 * Stored in chrome.storage.local.
 */
export interface LLMProviderConfig {
  providerType: ProviderType;
  /** Base URL of the API (e.g. https://api.openai.com/v1 or http://127.0.0.1:1234/v1) */
  baseUrl: string;
  /** Model identifier (e.g. gpt-4o-mini, or the model loaded in LM Studio) */
  model: string;
  /** API key — optional for local providers like LM Studio */
  apiKey?: string;
  /** Sampling temperature (0.0–2.0) */
  temperature?: number;
  /** Max tokens for the response */
  maxTokens?: number;
}

/**
 * Common interface for all LLM providers.
 *
 * To add a new provider:
 * 1. Add a new ProviderType discriminator above
 * 2. Create a class implementing this interface
 * 3. Register it in the factory (providers/factory.ts)
 */
export interface LLMProvider {
  /** Human-readable name of the provider */
  readonly name: string;

  /**
   * Generate a User Story from normalized Jira issue data.
   * @throws Error if the API call fails
   */
  generate(input: NormalizedIssueInput): Promise<UserStoryResult>;
}
