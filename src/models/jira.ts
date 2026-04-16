// ============================================================
// Jira Models — Raw extracted data and normalized input
// ============================================================

/**
 * Raw data extracted directly from the Jira DOM.
 * Fields may be null if not found on the page.
 * This type is coupled to the extraction layer only.
 */
export interface RawJiraIssue {
  issueKey: string | null;
  summary: string | null;
  description: string | null;
  issueType: string | null;
  priority: string | null;
  labels: string[];
  acceptanceCriteria: string | null;
  sourceUrl: string;
}

/**
 * Normalized issue input ready for LLM processing.
 * All fields have default values — no nulls.
 * This is the stable contract between extraction and generation.
 */
export interface NormalizedIssueInput {
  issueKey: string;
  summary: string;
  description: string;
  issueType: string;
  priority: string;
  labels: string[];
  acceptanceCriteria: string;
}
