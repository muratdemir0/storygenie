// ============================================================
// Provider Factory — Creates the right provider from config
// ============================================================

import type { LLMProvider, LLMProviderConfig } from './types';
import { OpenAICompatibleProvider } from './openai-compatible';

/**
 * Create an LLMProvider instance based on the given config.
 *
 * To add a new provider:
 * 1. Add the new ProviderType in types.ts
 * 2. Create the implementation class
 * 3. Add a case here
 */
export function createProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.providerType) {
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config);

    default: {
      // Exhaustiveness check — TypeScript will error if a ProviderType is missed
      const _exhaustive: never = config.providerType;
      throw new Error(`Unknown provider type: ${_exhaustive}`);
    }
  }
}
