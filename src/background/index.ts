// ============================================================
// Background Service Worker
// Message routing, provider coordination, session state
// ============================================================

import type { NormalizedIssueInput } from '../models/jira';
import type {
  ExtensionMessage,
  IssueDataResponse,
  GenerateStoryResponse,
  GetSettingsResponse,
  SaveSettingsResponse,
  FetchModelsResponse,
} from '../shared/messages';
import { MSG } from '../shared/messages';
import { normalizeIssue } from '../normalizer/index';
import { getSettings, saveSettings } from '../storage/index';
import { createProvider } from '../providers/factory';

// --- In-memory state (lives as long as the service worker) ---
// Maps tab ID → normalized issue data
const issueCache = new Map<number, NormalizedIssueInput>();

// --- Side Panel Setup ---

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('[StoryGenie] Failed to set panel behavior:', err));
});

// --- Message Handler ---

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    // Handle each message type
    switch (message.action) {
      case MSG.ISSUE_EXTRACTED:
        handleIssueExtracted(message.data, sender);
        sendResponse({ success: true, data: null });
        return false; // Synchronous response

      case MSG.GET_ISSUE_DATA:
        handleGetIssueData(sender)
          .then(sendResponse)
          .catch((err) =>
            sendResponse({ success: false, error: String(err) }),
          );
        return true; // Async response

      case MSG.GENERATE_STORY:
        handleGenerateStory(sender)
          .then(sendResponse)
          .catch((err) =>
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        return true; // Async response

      case MSG.GET_SETTINGS:
        handleGetSettings()
          .then(sendResponse)
          .catch((err) =>
            sendResponse({ success: false, error: String(err) }),
          );
        return true;

      case MSG.SAVE_SETTINGS:
        handleSaveSettings(message.data)
          .then(sendResponse)
          .catch((err) =>
            sendResponse({ success: false, error: String(err) }),
          );
        return true;

      case MSG.FETCH_MODELS:
        handleFetchModels(message.data)
          .then(sendResponse)
          .catch((err) =>
            sendResponse({ success: false, error: String(err) }),
          );
        return true;

      default:
        sendResponse({ success: false, error: 'Unknown message action' });
        return false;
    }
  },
);

// --- Handler Implementations ---

async function handleFetchModels(
  data: { baseUrl: string; apiKey?: string }
): Promise<FetchModelsResponse> {
  try {
    const base = data.baseUrl.replace(/\/+$/, '');
    const url = `${base}/models`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (data.apiKey) {
      headers['Authorization'] = `Bearer ${data.apiKey}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error body');
      return { success: false, error: `API error: ${response.status} ${response.statusText}\n${errorText}` };
    }

    const json = await response.json();
    
    // OpenAI standard: { data: [ { id: 'model-id' }, ... ] }
    if (json && Array.isArray(json.data)) {
      const modelIds = json.data.map((m: any) => m.id as string);
      return { success: true, data: modelIds };
    }

    return { success: false, error: 'Invalid response format: expected json.data to be an array.' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function handleIssueExtracted(
  rawData: ExtensionMessage & { action: typeof MSG.ISSUE_EXTRACTED } extends { data: infer D }
    ? D
    : never,
  sender: chrome.runtime.MessageSender,
): void {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  const normalized = normalizeIssue(rawData);
  issueCache.set(tabId, normalized);
  console.log(`[StoryGenie] Issue extracted for tab ${tabId}: ${normalized.issueKey}`);
}

async function handleGetIssueData(
  _sender: chrome.runtime.MessageSender,
): Promise<IssueDataResponse> {
  // Side panel messages don't have sender.tab, so we get the active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;

  if (!tabId) {
    return { success: true, data: null };
  }

  const cached = issueCache.get(tabId);
  return { success: true, data: cached ?? null };
}

async function handleGenerateStory(
  _sender: chrome.runtime.MessageSender,
): Promise<GenerateStoryResponse> {
  // Get the active tab's issue data
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;

  if (!tabId) {
    return { success: false, error: 'No active tab found.' };
  }

  const issueData = issueCache.get(tabId);
  if (!issueData) {
    return {
      success: false,
      error: 'No Jira issue data found. Make sure you are on a Jira issue page and the data has been extracted.',
    };
  }

  // Load provider config and generate
  const config = await getSettings();

  if (!config.baseUrl) {
    return {
      success: false,
      error: 'LLM provider is not configured. Please open Settings and configure your provider.',
    };
  }

  const provider = createProvider(config);
  const result = await provider.generate(issueData);

  return { success: true, data: result };
}

async function handleGetSettings(): Promise<GetSettingsResponse> {
  const config = await getSettings();
  return { success: true, data: config };
}

async function handleSaveSettings(
  config: ExtensionMessage & { action: typeof MSG.SAVE_SETTINGS } extends { data: infer D }
    ? D
    : never,
): Promise<SaveSettingsResponse> {
  await saveSettings(config);
  return { success: true, data: undefined as unknown as void };
}

// --- Tab cleanup ---
chrome.tabs.onRemoved.addListener((tabId) => {
  issueCache.delete(tabId);
});
