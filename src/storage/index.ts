// ============================================================
// Storage — Chrome storage wrapper for extension settings
// ============================================================

import type { LLMProviderConfig } from '../providers/types';
import { STORAGE_KEYS, DEFAULT_PROVIDER_CONFIG } from '../shared/constants';

/**
 * Load the LLM provider config from chrome.storage.local.
 * Returns the default config if nothing is saved yet.
 */
export async function getSettings(): Promise<LLMProviderConfig> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PROVIDER_CONFIG);
  const stored = result[STORAGE_KEYS.PROVIDER_CONFIG];

  if (!stored) {
    return { ...DEFAULT_PROVIDER_CONFIG };
  }

  // Merge with defaults to handle missing fields after upgrades
  return {
    ...DEFAULT_PROVIDER_CONFIG,
    ...stored,
  };
}

/**
 * Save the LLM provider config to chrome.storage.local.
 */
export async function saveSettings(config: LLMProviderConfig): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.PROVIDER_CONFIG]: config,
  });
}
