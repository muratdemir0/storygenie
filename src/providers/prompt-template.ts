// ============================================================
// Prompt Template — Converts normalized issue data to LLM prompts
// ============================================================

import type { NormalizedIssueInput } from '../models/jira';

/**
 * System prompt that instructs the LLM on the expected output format.
 */
const SYSTEM_PROMPT = `You are an expert Agile product analyst. Your job is to transform Jira ticket data into a highly structured User Story following the EXACT visual and logical format provided.

RULES:
- Use the exact structure and labels below.
- "As", "I want", and "So that" MUST be on separate lines.
- Each scenario should have its own section (SCENARIO X).
- Acceptance Criteria (AC) must belong to a Scenario and be numbered (AC X).
- Use Given/When/Then format for all ACs.
- Use Data Tables (| header |) for scenarios with multiple variations or edge cases.
- Professional, clear, and structured language is required.

OUTPUT FORMAT:

[Feature Title]

As [Role]
I want [Goal]
So that [Benefit/Value]

Assumptions:
- [Assumption]

Contains:
- [Detail]

Background for scenario [X] & [Y]:
Given [Precondition]

SCENARIO 1 - [Scenario Title]
AC 1: [AC Title]
Given [Condition]
When [Action]
Then [Result]

AC 2: [AC Title]
Given [Condition]
When [Action]
Then [Result]

(Add Data Tables if variations exist)
| header | header |
|---|---|
| value | value |

SCENARIO 2 - [Scenario Title]
...`;

/**
 * Build the user message from normalized issue data.
 * This is the "data payload" the model will work with.
 */
function buildUserMessage(input: NormalizedIssueInput): string {
  const parts: string[] = [
    `## Jira Ticket: ${input.issueKey}`,
    '',
    `**Summary:** ${input.summary}`,
    `**Issue Type:** ${input.issueType}`,
    `**Priority:** ${input.priority}`,
  ];

  if (input.labels.length > 0) {
    parts.push(`**Labels:** ${input.labels.join(', ')}`);
  }

  if (input.description) {
    parts.push('', '### Description', input.description);
  }

  if (input.acceptanceCriteria) {
    parts.push('', '### Acceptance Criteria (from ticket)', input.acceptanceCriteria);
  }

  parts.push(
    '',
    '---',
    'Please transform the above Jira ticket into a well-structured User Story using the format specified in your instructions.',
  );

  return parts.join('\n');
}

/**
 * Build the messages array for an OpenAI-compatible Chat Completions call.
 */
export function buildPromptMessages(
  input: NormalizedIssueInput,
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserMessage(input) },
  ];
}
