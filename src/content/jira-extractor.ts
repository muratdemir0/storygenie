// ============================================================
// Content Script — Jira Issue DOM Extractor
//
// This module is the ONLY place in the codebase that touches
// Jira's DOM. All selectors and extraction logic lives here.
// When migrating to the Jira REST API, replace this file only.
// ============================================================

import type { RawJiraIssue } from '../models/jira';
import { MSG } from '../shared/messages';
import {
  JIRA_ISSUE_URL_PATTERNS,
  JIRA_RENDER_TIMEOUT_MS,
  JIRA_POLL_INTERVAL_MS,
} from '../shared/constants';

// --- Entry Point ---

(() => {
  const issueKey = extractIssueKeyFromUrl(window.location.href);
  if (!issueKey) return; // Not on an issue page

  console.log(`[StoryGenie] Detected Jira issue page: ${issueKey}`);
  waitForPageAndExtract(issueKey);
})();

// --- URL Parsing ---

function extractIssueKeyFromUrl(url: string): string | null {
  for (const pattern of JIRA_ISSUE_URL_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

// --- Wait for Jira to render, then extract ---

function waitForPageAndExtract(issueKey: string): void {
  const startTime = Date.now();

  const poll = () => {
    // Check if the summary heading is rendered
    const summaryEl = findSummaryElement();
    if (summaryEl) {
      extractAndSend(issueKey);
      observeNavigation(issueKey);
      return;
    }

    // Timeout check
    if (Date.now() - startTime > JIRA_RENDER_TIMEOUT_MS) {
      console.warn('[StoryGenie] Timed out waiting for Jira page to render. Extracting what we can.');
      extractAndSend(issueKey);
      return;
    }

    setTimeout(poll, JIRA_POLL_INTERVAL_MS);
  };

  poll();
}

// --- DOM Extraction ---

function extractAndSend(issueKey: string): void {
  const raw = extractFromDom(issueKey);

  chrome.runtime.sendMessage(
    { action: MSG.ISSUE_EXTRACTED, data: raw },
    () => {
      // Check for runtime errors (e.g. if background is not ready)
      if (chrome.runtime.lastError) {
        console.warn('[StoryGenie] Failed to send extracted data:', chrome.runtime.lastError.message);
      }
    },
  );
}

function extractFromDom(issueKey: string): RawJiraIssue {
  return {
    issueKey,
    summary: extractSummary(),
    description: extractDescription(),
    issueType: extractIssueType(),
    priority: extractPriority(),
    labels: extractLabels(),
    acceptanceCriteria: extractAcceptanceCriteria(),
    sourceUrl: window.location.href,
  };
}

// --- Individual Field Extractors ---
// Each function tries multiple selectors in order of reliability.
// data-testid attributes first, then semantic fallbacks.

function findSummaryElement(): Element | null {
  return (
    document.querySelector('[data-testid="issue.views.issue-base.foundation.summary.heading"]') ??
    document.querySelector('[data-testid="issue-field-summary"]') ??
    document.querySelector('h1[data-testid]') ??
    document.querySelector('#summary-val') ?? // Jira Server fallback
    null
  );
}

function extractSummary(): string | null {
  const el = findSummaryElement();
  return el?.textContent?.trim() ?? null;
}

function extractDescription(): string | null {
  // Jira Cloud new view
  const descContainer =
    document.querySelector('[data-testid="issue.views.field.rich-text.description"]') ??
    document.querySelector('[data-testid="issue-field-description"]') ??
    document.querySelector('[data-testid="issue.views.issue-base.foundation.description.visible-content"]');

  if (descContainer) {
    return descContainer.textContent?.trim() ?? null;
  }

  // Jira Server / older views
  const serverDesc = document.querySelector('#description-val');
  if (serverDesc) {
    return serverDesc.textContent?.trim() ?? null;
  }

  // Try to find description in the issue detail panel
  const allPanels = document.querySelectorAll('[data-test-id*="description"], [aria-label*="Description"]');
  for (const panel of allPanels) {
    const text = panel.textContent?.trim();
    if (text && text.length > 10) return text;
  }

  return null;
}

function extractIssueType(): string | null {
  // data-testid based
  const typeEl =
    document.querySelector('[data-testid="issue.views.issue-base.foundation.issue-type.button"]') ??
    document.querySelector('[data-testid="issue-field-issuetype"]');
  if (typeEl) {
    return typeEl.textContent?.trim() ?? null;
  }

  // Breadcrumb-based (Jira Cloud often shows type in breadcrumb)
  const breadcrumbType = document.querySelector('#type-val');
  if (breadcrumbType) {
    return breadcrumbType.textContent?.trim() ?? null;
  }

  // Try img alt text (Jira shows type as an icon with alt text)
  const typeImg = document.querySelector('#type-val img, [data-testid*="issue-type"] img');
  if (typeImg) {
    return typeImg.getAttribute('alt') ?? null;
  }

  return null;
}

function extractPriority(): string | null {
  const priorityEl =
    document.querySelector('[data-testid="issue.views.issue-base.foundation.priority.button"]') ??
    document.querySelector('[data-testid="issue-field-priority"]');
  if (priorityEl) {
    return priorityEl.textContent?.trim() ?? null;
  }

  // Jira Server
  const serverPriority = document.querySelector('#priority-val');
  if (serverPriority) {
    return serverPriority.textContent?.trim() ?? null;
  }

  const priorityImg = document.querySelector('#priority-val img, [data-testid*="priority"] img');
  if (priorityImg) {
    return priorityImg.getAttribute('alt') ?? null;
  }

  return null;
}

function extractLabels(): string[] {
  const labels: string[] = [];

  // Jira Cloud
  const labelContainer =
    document.querySelector('[data-testid="issue.views.field.multi-select.labels"]') ??
    document.querySelector('[data-testid="issue-field-labels"]');
  if (labelContainer) {
    const labelElements = labelContainer.querySelectorAll('a, span[role="option"], [data-testid*="label"]');
    labelElements.forEach((el) => {
      const text = el.textContent?.trim();
      if (text && text !== 'None') labels.push(text);
    });
    if (labels.length > 0) return labels;
  }

  // Jira Server
  const serverLabels = document.querySelector('#wrap-labels .labels');
  if (serverLabels) {
    serverLabels.querySelectorAll('a').forEach((a) => {
      const text = a.textContent?.trim();
      if (text) labels.push(text);
    });
  }

  return labels;
}

function extractAcceptanceCriteria(): string | null {
  // Acceptance Criteria is often a custom field. Look for it by label text.
  const allLabels = document.querySelectorAll(
    '[data-testid*="label"], label, strong, h3, h4, [role="heading"]',
  );

  for (const label of allLabels) {
    const text = label.textContent?.trim().toLowerCase() ?? '';
    if (
      text.includes('acceptance criteria') ||
      text.includes('kabul kriterleri') || // Turkish
      text.includes('acceptance criterion')
    ) {
      // Try to get the next sibling's content, or the parent container's content
      const parent = label.closest('[data-testid*="field"]') ?? label.parentElement;
      if (parent) {
        // Remove the label text itself from the result
        const fullText = parent.textContent?.trim() ?? '';
        const labelText = label.textContent?.trim() ?? '';
        const acText = fullText.replace(labelText, '').trim();
        if (acText.length > 0) return acText;
      }
    }
  }

  // Try direct custom field selectors
  const acField =
    document.querySelector('[data-testid*="acceptance-criteria"]') ??
    document.querySelector('[data-testid*="customfield"][data-testid*="acceptance"]');
  if (acField) {
    return acField.textContent?.trim() ?? null;
  }

  return null;
}

// --- SPA Navigation Observer ---
// Jira is an SPA — detect when the user navigates to a different issue

function observeNavigation(currentKey: string): void {
  let lastUrl = window.location.href;

  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      const newKey = extractIssueKeyFromUrl(lastUrl);
      if (newKey && newKey !== currentKey) {
        console.log(`[StoryGenie] Navigation detected: ${currentKey} → ${newKey}`);
        waitForPageAndExtract(newKey);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
