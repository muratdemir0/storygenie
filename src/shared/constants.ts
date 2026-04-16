// ============================================================
// Constants — Default values and storage keys
// ============================================================

import type { LLMProviderConfig } from '../providers/types';

/** Chrome storage keys */
export const STORAGE_KEYS = {
  PROVIDER_CONFIG: 'storygenie_provider_config',
} as const;

/** Default provider configuration (OpenAI) */
export const DEFAULT_PROVIDER_CONFIG: LLMProviderConfig = {
  providerType: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  apiKey: '',
  temperature: 0.7,
  maxTokens: 2048,
};

/** Jira URL pattern for issue detection */
export const JIRA_ISSUE_URL_PATTERNS = [
  /\/browse\/([A-Z][A-Z0-9_]+-\d+)/,    // Classic: /browse/PROJ-123
  /\/issue\/([A-Z][A-Z0-9_]+-\d+)/,     // New view: /issue/PROJ-123
  /selectedIssue=([A-Z][A-Z0-9_]+-\d+)/, // Board view: ?selectedIssue=PROJ-123
  /(mock_jira\.html)/,                  // Testing: our mock file (fixed with capture group)
];

/** How long to wait for Jira page to render (ms) */
export const JIRA_RENDER_TIMEOUT_MS = 10_000;

/** How often to check for DOM changes during extraction (ms) */
export const JIRA_POLL_INTERVAL_MS = 500;
