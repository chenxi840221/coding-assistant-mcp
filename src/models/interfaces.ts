// Type definitions and interfaces
import { Anthropic } from '@anthropic-ai/sdk';

// Configuration interface
export interface Config {
  apiKey: string;
  model: string;
  maxContextSize: number;
  maxTokens: number;
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

// Global state
export interface GlobalState {
  anthropic?: Anthropic;
  config?: Config;
  projectInfo?: ProjectInfo;
  fileContents?: Map<string, string>;
}

// Create a global client instance
export const globalState: GlobalState = {
  fileContents: new Map<string, string>()
};