// ============================================================
// Side Panel — Main UI logic
// ============================================================

import type { NormalizedIssueInput } from '../models/jira';
import type { UserStoryResult } from '../models/story';
import type { LLMProviderConfig } from '../providers/types';
import type { ExtensionResponse } from '../shared/messages';
import { MSG } from '../shared/messages';

// --- DOM Element References ---

const elements = {
  // Sections
  sectionEmpty: document.getElementById('section-empty')!,
  sectionIssue: document.getElementById('section-issue')!,
  sectionLoading: document.getElementById('section-loading')!,
  sectionError: document.getElementById('section-error')!,
  sectionStory: document.getElementById('section-story')!,

  // Issue fields
  issueKey: document.getElementById('issue-key')!,
  issueTypeBadge: document.getElementById('issue-type-badge')!,
  issuePriorityBadge: document.getElementById('issue-priority-badge')!,
  issueSummary: document.getElementById('issue-summary')!,
  issueDescription: document.getElementById('issue-description')!,
  issueDescriptionBlock: document.getElementById('issue-description-block')!,
  issueLabels: document.getElementById('issue-labels')!,
  issueLabelsBlock: document.getElementById('issue-labels-block')!,
  issueAc: document.getElementById('issue-ac')!,
  issueAcBlock: document.getElementById('issue-ac-block')!,

  // Buttons
  btnGenerate: document.getElementById('btn-generate')!,
  btnCopy: document.getElementById('btn-copy')!,
  btnCopyText: document.getElementById('btn-copy-text')!,
  btnRetry: document.getElementById('btn-retry')!,
  btnRegenerate: document.getElementById('btn-regenerate')!,

  // Story output
  storyContent: document.getElementById('story-content')!,
  storyProvider: document.getElementById('story-provider')!,
  storyModel: document.getElementById('story-model')!,
  storyFooter: document.getElementById('story-footer')!,

  // Error
  errorMessage: document.getElementById('error-message')!,

  // Settings
  btnSettingsToggle: document.getElementById('btn-settings-toggle')!,
  btnSettingsClose: document.getElementById('btn-settings-close')!,
  btnSettingsCancel: document.getElementById('btn-settings-cancel')!,
  settingsOverlay: document.getElementById('settings-overlay')!,
  settingsForm: document.getElementById('settings-form') as HTMLFormElement,
  settingsStatus: document.getElementById('settings-status')!,
  settingProvider: document.getElementById('setting-provider') as HTMLSelectElement,
  settingBaseUrl: document.getElementById('setting-base-url') as HTMLInputElement,
  settingModel: document.getElementById('setting-model') as HTMLInputElement,
  modelList: document.getElementById('model-list') as HTMLDataListElement,
  btnFetchModels: document.getElementById('btn-fetch-models') as HTMLButtonElement,
  settingApiKey: document.getElementById('setting-api-key') as HTMLInputElement,
  settingTemperature: document.getElementById('setting-temperature') as HTMLInputElement,
  settingMaxTokens: document.getElementById('setting-max-tokens') as HTMLInputElement,
};

// --- State ---

let currentIssue: NormalizedIssueInput | null = null;
let currentStory: UserStoryResult | null = null;

// --- Section Visibility ---

type SectionName = 'empty' | 'issue' | 'loading' | 'error' | 'story';

function showSection(name: SectionName, keepIssue = false): void {
  elements.sectionEmpty.style.display = name === 'empty' ? '' : 'none';
  elements.sectionIssue.style.display = (name === 'issue' || keepIssue) ? '' : 'none';
  elements.sectionLoading.style.display = name === 'loading' ? '' : 'none';
  elements.sectionError.style.display = name === 'error' ? '' : 'none';
  elements.sectionStory.style.display = name === 'story' ? '' : 'none';
  // Show/hide the footer
  elements.storyFooter.style.display = name === 'story' ? '' : 'none';
}

// --- Render Issue Data ---

function renderIssueData(issue: NormalizedIssueInput): void {
  currentIssue = issue;

  elements.issueKey.textContent = issue.issueKey;
  elements.issueTypeBadge.textContent = issue.issueType;
  elements.issuePriorityBadge.textContent = issue.priority;
  elements.issueSummary.textContent = issue.summary;

  // Description
  if (issue.description) {
    elements.issueDescription.textContent = issue.description;
    elements.issueDescriptionBlock.style.display = '';
  } else {
    elements.issueDescriptionBlock.style.display = 'none';
  }

  // Labels
  if (issue.labels.length > 0) {
    elements.issueLabels.innerHTML = issue.labels
      .map((l) => `<span class="label-tag">${escapeHtml(l)}</span>`)
      .join('');
    elements.issueLabelsBlock.style.display = '';
  } else {
    elements.issueLabelsBlock.style.display = 'none';
  }

  // Acceptance Criteria
  if (issue.acceptanceCriteria) {
    elements.issueAc.textContent = issue.acceptanceCriteria;
    elements.issueAcBlock.style.display = '';
  } else {
    elements.issueAcBlock.style.display = 'none';
  }

  showSection('issue');
}

// --- Render Story ---

function renderStory(story: UserStoryResult): void {
  currentStory = story;

  elements.storyContent.innerHTML = renderMarkdown(story.raw);
  elements.storyProvider.textContent = story.provider;
  elements.storyModel.textContent = story.model;

  showSection('story', true);
}

// ============================================================
// Markdown → HTML renderer
// Produces Gherkin code blocks, Scenario blocks, and AC blocks
// ============================================================

function renderMarkdown(text: string): string {
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let inTable = false;
  let inGherkin = false;
  let inAc = false;
  let inScenario = false;
  let tableRows: string[] = [];

  const flushList = () => {
    if (inList) { html += '</ul>'; inList = false; }
  };
  const flushGherkin = () => {
    if (inGherkin) { html += '</div>'; inGherkin = false; }
  };
  const flushTable = () => {
    if (inTable) {
      if (tableRows.length > 0) {
        html += '<div class="table-container"><table>';
        tableRows.forEach((row, idx) => {
          const cells = row.split('|').filter(c => c.trim() !== '').map(c => c.trim());
          if (idx === 0) {
            html += `<thead><tr>${cells.map(c => `<th>${renderInlineMarkdown(escapeHtml(c))}</th>`).join('')}</tr></thead><tbody>`;
          } else if (idx === 1 && row.includes('---')) {
            // skip separator
          } else {
            html += `<tr>${cells.map(c => `<td>${renderInlineMarkdown(escapeHtml(c))}</td>`).join('')}</tr>`;
          }
        });
        html += '</tbody></table></div>';
      }
      inTable = false;
      tableRows = [];
    }
  };
  const flushAc = () => {
    flushGherkin();
    if (inAc) { html += '</div>'; inAc = false; }
  };
  const flushScenario = () => {
    flushAc();
    if (inScenario) { html += '</div>'; inScenario = false; }
  };
  const flushAll = () => {
    flushList();
    flushTable();
    flushScenario();
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    // --- Tables ---
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList(); flushGherkin();
      inTable = true;
      tableRows.push(trimmed);
      return;
    } else if (inTable) {
      flushTable();
    }

    // --- Gherkin keywords: Given / When / Then ---
    const gherkinMatch = trimmed.match(/^(Given|When|Then)\b\s*(.*)/);
    if (gherkinMatch) {
      flushList(); flushTable();
      const keyword = gherkinMatch[1];
      const rest = gherkinMatch[2];
      const kwClass = `kw-${keyword.toLowerCase()}`;
      if (!inGherkin) {
        html += '<div class="gherkin">';
        inGherkin = true;
      }
      html += `<div class="gherkin-line"><span class="kw ${kwClass}">${keyword.toUpperCase()}</span><span>${renderInlineMarkdown(escapeHtml(rest))}</span></div>`;
      return;
    }

    // Close gherkin if we hit a non-gherkin line
    if (inGherkin) { flushGherkin(); }

    // --- SCENARIO header ---
    const scenarioMatch = trimmed.match(/^SCENARIO\s+(\d+)\s*[-–—·]\s*(.*)/i);
    if (scenarioMatch) {
      flushList(); flushTable(); flushScenario();
      const num = scenarioMatch[1].padStart(2, '0');
      const title = scenarioMatch[2];
      html += `<div class="scenario-block"><div class="scenario-header"><div class="scenario-label">SCENARIO ${num}</div><div class="scenario-title">${renderInlineMarkdown(escapeHtml(title))}</div></div>`;
      inScenario = true;
      return;
    }

    // --- AC header ---
    const acMatch = trimmed.match(/^AC\s+(\d+)\s*[:·–—]\s*(.*)/i);
    if (acMatch) {
      flushList(); flushTable(); flushAc();
      const num = acMatch[1];
      const title = acMatch[2];
      html += `<div class="ac"><div class="ac-header"><span class="ac-tag">AC ${num}</span><span class="ac-title">${renderInlineMarkdown(escapeHtml(title))}</span></div>`;
      inAc = true;
      return;
    }

    // --- List items ---
    if (trimmed.startsWith('- ')) {
      flushGherkin(); flushTable();
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${renderInlineMarkdown(escapeHtml(trimmed.slice(2)))}</li>`;
      return;
    } else {
      flushList();
    }

    // --- Headers ---
    if (trimmed.startsWith('## ')) {
      flushAll();
      html += `<h2>${renderInlineMarkdown(escapeHtml(trimmed.slice(3)))}</h2>`;
    } else if (trimmed.startsWith('### ')) {
      flushAll();
      html += `<h3>${renderInlineMarkdown(escapeHtml(trimmed.slice(4)))}</h3>`;
    }
    // --- As / I want / So that ---
    else if (/^(As|I want|So that)\b/.test(trimmed)) {
      const match = trimmed.match(/^(As|I want|So that)\b\s*(.*)/);
      if (match) {
        html += `<p><strong>${escapeHtml(match[1])}</strong> ${renderInlineMarkdown(escapeHtml(match[2]))}</p>`;
      }
    }
    // --- Section labels ---
    else if (/^(Assumptions|Contains|Background)\b/.test(trimmed)) {
      html += `<h3>${renderInlineMarkdown(escapeHtml(trimmed))}</h3>`;
    }
    // --- Empty line ---
    else if (trimmed === '') {
      // natural spacing
    }
    // --- Regular paragraph ---
    else {
      html += `<p>${renderInlineMarkdown(escapeHtml(trimmed))}</p>`;
    }
  });

  flushAll();
  return html;
}

function renderInlineMarkdown(text: string): string {
  // Bold: **text**
  let result = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  result = result.replace(/\*(.*?)\*/g, '<em>$1</em>');
  return result;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- Show Error ---

function showError(message: string): void {
  elements.errorMessage.textContent = message;
  showSection('error', !!currentIssue);
}

// --- Message Sending ---

function sendMessage<T>(message: Record<string, unknown>): Promise<ExtensionResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: ExtensionResponse<T>) => {
      if (chrome.runtime.lastError) {
        resolve({
          success: false,
          error: chrome.runtime.lastError.message ?? 'Unknown extension error',
        });
        return;
      }
      resolve(response);
    });
  });
}

// --- Load Issue Data ---

async function loadIssueData(): Promise<void> {
  const response = await sendMessage<NormalizedIssueInput | null>({
    action: MSG.GET_ISSUE_DATA,
  });

  if (response.success && response.data) {
    renderIssueData(response.data);
  } else {
    showSection('empty');
  }
}

// --- Generate Story ---

async function generateStory(): Promise<void> {
  showSection('loading', true);

  const response = await sendMessage<UserStoryResult>({
    action: MSG.GENERATE_STORY,
  });

  if (response.success) {
    renderStory(response.data);
  } else {
    showError(response.error);
  }
}

// --- Copy to Clipboard ---

async function copyStoryToClipboard(): Promise<void> {
  if (!currentStory) return;

  try {
    await navigator.clipboard.writeText(currentStory.raw);
    elements.btnCopyText.textContent = 'Copied!';
    elements.btnCopy.classList.add('btn-copy-success');
    setTimeout(() => {
      elements.btnCopyText.textContent = 'Copy';
      elements.btnCopy.classList.remove('btn-copy-success');
    }, 2000);
  } catch {
    elements.btnCopyText.textContent = 'Failed';
    setTimeout(() => {
      elements.btnCopyText.textContent = 'Copy';
    }, 2000);
  }
}

// --- Settings ---

async function loadSettings(): Promise<void> {
  const response = await sendMessage<LLMProviderConfig>({
    action: MSG.GET_SETTINGS,
  });

  if (response.success) {
    const config = response.data;
    elements.settingProvider.value = config.providerType;
    elements.settingBaseUrl.value = config.baseUrl;
    elements.settingModel.value = config.model;
    elements.settingApiKey.value = config.apiKey ?? '';
    elements.settingTemperature.value = String(config.temperature ?? 0.7);
    elements.settingMaxTokens.value = String(config.maxTokens ?? 2048);
  }
}

async function saveSettingsFromForm(): Promise<void> {
  const config: LLMProviderConfig = {
    providerType: elements.settingProvider.value as LLMProviderConfig['providerType'],
    baseUrl: elements.settingBaseUrl.value.trim(),
    model: elements.settingModel.value.trim(),
    apiKey: elements.settingApiKey.value.trim() || undefined,
    temperature: parseFloat(elements.settingTemperature.value) || 0.7,
    maxTokens: parseInt(elements.settingMaxTokens.value, 10) || 2048,
  };

  const response = await sendMessage<void>({
    action: MSG.SAVE_SETTINGS,
    data: config,
  });

  const statusEl = elements.settingsStatus;
  statusEl.style.display = '';

  if (response.success) {
    statusEl.textContent = '✓ Settings saved successfully';
    statusEl.className = 'settings-status success';
    setTimeout(() => {
      statusEl.style.display = 'none';
      closeSettings();
    }, 1200);
  } else {
    statusEl.textContent = `Failed to save: ${response.error}`;
    statusEl.className = 'settings-status error';
  }
}

function openSettings(): void {
  loadSettings();
  elements.settingsOverlay.style.display = '';
}

async function fetchModels(): Promise<void> {
  const baseUrl = elements.settingBaseUrl.value.trim();
  const apiKey = elements.settingApiKey.value.trim();

  if (!baseUrl) {
    showSettingsStatus('Please enter a Base URL first', 'error');
    return;
  }

  // Animation/Loading state for the button
  const originalHtml = elements.btnFetchModels.innerHTML;
  elements.btnFetchModels.innerHTML = '<span class="spinner-sm"></span>';
  elements.btnFetchModels.disabled = true;

  const response = await sendMessage<string[]>({
    action: MSG.FETCH_MODELS,
    data: { baseUrl, apiKey: apiKey || undefined },
  });

  elements.btnFetchModels.innerHTML = originalHtml;
  elements.btnFetchModels.disabled = false;

  if (response.success) {
    const models = response.data;
    // Clear current value to let user select from the new list
    elements.settingModel.value = '';
    // Clear list
    elements.modelList.innerHTML = '';
    // Populate list
    models.forEach((model) => {
      const option = document.createElement('option');
      option.value = model;
      elements.modelList.appendChild(option);
    });

    showSettingsStatus(`✓ Fetched ${models.length} models`, 'success');
  } else {
    showSettingsStatus(`Fetch failed: ${response.error}`, 'error');
  }
}

function showSettingsStatus(message: string, type: 'success' | 'error'): void {
  const statusEl = elements.settingsStatus;
  statusEl.textContent = message;
  statusEl.className = `settings-status ${type}`;
  statusEl.style.display = '';
  if (type === 'success') {
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}

function closeSettings(): void {
  elements.settingsOverlay.style.display = 'none';
  elements.settingsStatus.style.display = 'none';
}

// --- Event Listeners ---

elements.btnGenerate.addEventListener('click', generateStory);
elements.btnCopy.addEventListener('click', copyStoryToClipboard);
elements.btnRetry.addEventListener('click', generateStory);
elements.btnRegenerate.addEventListener('click', generateStory);

elements.btnSettingsToggle.addEventListener('click', openSettings);
elements.btnSettingsClose.addEventListener('click', closeSettings);
elements.btnSettingsCancel.addEventListener('click', closeSettings);
elements.btnFetchModels.addEventListener('click', fetchModels);

elements.settingsOverlay.addEventListener('click', (e) => {
  if (e.target === elements.settingsOverlay) closeSettings();
});

elements.settingsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  saveSettingsFromForm();
});

// --- Init ---

loadIssueData();

// Poll for issue data when active tab changes (side panel persists across navigations)
let pollInterval: ReturnType<typeof setInterval> | null = null;

function startPolling(): void {
  if (pollInterval) return;
  pollInterval = setInterval(async () => {
    const response = await sendMessage<NormalizedIssueInput | null>({
      action: MSG.GET_ISSUE_DATA,
    });

    if (response.success && response.data) {
      // Only update if it's a different issue
      if (!currentIssue || currentIssue.issueKey !== response.data.issueKey) {
        currentStory = null; // Reset story on issue change
        renderIssueData(response.data);
      }
    }
  }, 2000);
}

startPolling();

// Clean up on unload
window.addEventListener('beforeunload', () => {
  if (pollInterval) clearInterval(pollInterval);
});
