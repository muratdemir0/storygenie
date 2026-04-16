// ============================================================
// Message Types — Type-safe message passing between extension parts
// ============================================================

import type { RawJiraIssue, NormalizedIssueInput } from '../models/jira';
import type { UserStoryResult } from '../models/story';
import type { LLMProviderConfig } from '../providers/types';

// --- Message Action Constants ---

export const MSG = {
  /** Content script → Background: extracted Jira issue data */
  ISSUE_EXTRACTED: 'ISSUE_EXTRACTED',
  /** Side panel → Background: request current issue data */
  GET_ISSUE_DATA: 'GET_ISSUE_DATA',
  /** Side panel → Background: trigger story generation */
  GENERATE_STORY: 'GENERATE_STORY',
  /** Side panel → Background: read settings */
  GET_SETTINGS: 'GET_SETTINGS',
  /** Side panel → Background: save settings */
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  /** Side panel → Background: fetch models from provider */
  FETCH_MODELS: 'FETCH_MODELS',
} as const;

export type MessageAction = (typeof MSG)[keyof typeof MSG];

// --- Message Payloads ---

export interface IssueExtractedMessage {
  action: typeof MSG.ISSUE_EXTRACTED;
  data: RawJiraIssue;
}

export interface GetIssueDataMessage {
  action: typeof MSG.GET_ISSUE_DATA;
}

export interface GenerateStoryMessage {
  action: typeof MSG.GENERATE_STORY;
}

export interface GetSettingsMessage {
  action: typeof MSG.GET_SETTINGS;
}

export interface SaveSettingsMessage {
  action: typeof MSG.SAVE_SETTINGS;
  data: LLMProviderConfig;
}

export interface FetchModelsMessage {
  action: typeof MSG.FETCH_MODELS;
  data: {
    baseUrl: string;
    apiKey?: string;
  };
}

export type ExtensionMessage =
  | IssueExtractedMessage
  | GetIssueDataMessage
  | GenerateStoryMessage
  | GetSettingsMessage
  | SaveSettingsMessage
  | FetchModelsMessage;

// --- Response Types ---

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export type ExtensionResponse<T> = SuccessResponse<T> | ErrorResponse;

// Concrete response types for each message
export type IssueDataResponse = ExtensionResponse<NormalizedIssueInput | null>;
export type GenerateStoryResponse = ExtensionResponse<UserStoryResult>;
export type GetSettingsResponse = ExtensionResponse<LLMProviderConfig>;
export type SaveSettingsResponse = ExtensionResponse<void>;
export type FetchModelsResponse = ExtensionResponse<string[]>;
