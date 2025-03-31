// src/models/interfaces.ts
import { Anthropic } from '@anthropic-ai/sdk';
import * as vscode from 'vscode';

/**
 * Global application state
 */
export interface GlobalState {
  context?: vscode.ExtensionContext;
  anthropic?: Anthropic;
  config?: Config;
  projectInfo?: Record<string, DirectoryInfo>;
  fileContents?: Map<string, string>;
  webViewManager?: any;
}

/**
 * Application configuration
 */
export interface Config {
  apiKey: string;
  model: string;
  maxTokens: number;
  maxContextSize: number;
}

/**
 * Chat message structure
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Chat session structure
 */
export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
}

/**
 * Directory structure information
 */
export interface DirectoryInfo {
  files: string[];
  directories: Record<string, DirectoryInfo>;
}

/**
 * Vector store document
 */
export interface VectorDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, any>;
}

/**
 * Model Control Protocol (MCP) Tool Definition
 */
export interface MCPTool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Global state object
 */
export const globalState: GlobalState = {
  fileContents: new Map<string, string>(),
  projectInfo: {}
};