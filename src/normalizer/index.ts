// ============================================================
// Normalizer — Convert raw Jira data to stable internal model
// ============================================================

import type { RawJiraIssue, NormalizedIssueInput } from '../models/jira';

/**
 * Strip HTML tags and decode common HTML entities.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Normalize whitespace: collapse multiple blank lines, trim lines.
 */
function normalizeWhitespace(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Clean and normalize a raw text field.
 */
function cleanField(value: string | null | undefined): string {
  if (!value) return '';
  return normalizeWhitespace(stripHtml(value));
}

/**
 * Convert a RawJiraIssue into a NormalizedIssueInput.
 *
 * This function is pure — no DOM or provider dependencies.
 * It fills missing fields with sensible defaults so the rest
 * of the pipeline never deals with null values.
 */
export function normalizeIssue(raw: RawJiraIssue): NormalizedIssueInput {
  return {
    issueKey: raw.issueKey?.trim() || 'UNKNOWN',
    summary: cleanField(raw.summary) || 'No summary available',
    description: cleanField(raw.description),
    issueType: cleanField(raw.issueType) || 'Task',
    priority: cleanField(raw.priority) || 'Medium',
    labels: raw.labels
      .map((l) => l.trim())
      .filter((l) => l.length > 0),
    acceptanceCriteria: cleanField(raw.acceptanceCriteria),
  };
}
