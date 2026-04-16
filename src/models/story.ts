// ============================================================
// Story Models — Generated User Story output
// ============================================================

/**
 * Result of an LLM-generated User Story.
 */
export interface UserStoryResult {
  /** The full generated text (markdown-formatted) */
  raw: string;
  /** Unix timestamp when the story was generated */
  generatedAt: number;
  /** The Jira issue key this story was generated for */
  issueKey: string;
  /** Name of the provider used */
  provider: string;
  /** Name of the model used */
  model: string;
}
