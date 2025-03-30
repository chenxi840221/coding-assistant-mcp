import { Anthropic } from '@anthropic-ai/sdk';
import * as vscode from 'vscode';
import { WebViewManager } from '../chat/chat-view';

// The rest of the file remains the same
export interface GlobalState {
  context?: vscode.ExtensionContext;
  webViewManager?: WebViewManager;
  projectInfo?: ProjectInfo;
  config?: Config;
  anthropic?: Anthropic;
}

// Other existing interfaces...

// Configuration interface
export interface Config {
  apiKey: string;
  model: string;
  maxContextSize: number;
  maxTokens: number;
  maxGeneratedFileLength: number;
}

// MCP message interfaces
export interface MCPMessage {
  role: 'user' | 'assistant';
  content: MCPContent[];
}

export type MCPContent = MCPTextContent | MCPToolContent;

export interface MCPTextContent {
  type: 'text';
  text: string;
}

export interface MCPToolContent {
  type: 'tool_use' | 'tool_result';
  id: string;
  name?: string;
  input?: any;
  content?: any;
}

export interface MCPTool {
  name: string;
  description: string;
  input_schema: any;
}

// Chat message interface
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Chat session interface
export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
}

// Project structure interfaces
export interface ProjectInfo {
  [folderName: string]: DirectoryInfo;
}

export interface DirectoryInfo {
  files: string[];
  directories: { [name: string]: DirectoryInfo };
}