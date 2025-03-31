// src/services/claude-service.ts

import * as vscode from 'vscode';
import { getAnthropicClient, getConfig, isClientConfigured } from '../config/configuration';

/**
 * Claude service singleton
 */
let claudeService: ClaudeService | undefined;

/**
 * Get the Claude service instance
 */
export function getClaudeService(): ClaudeService {
  if (!claudeService) {
    claudeService = new ClaudeService();
  }
  return claudeService;
}

/**
 * Service for interacting with Claude API
 */
export class ClaudeService {
  /**
   * Check if the service is configured with a valid API key
   */
  public isConfigured(): boolean {
    return isClientConfigured();
  }

  /**
   * Send a message to Claude and get a response
   */
  public async sendMessage(message: string): Promise<string> {
    const anthropic = getAnthropicClient();
    const config = getConfig();
    
    if (!anthropic || !config) {
      throw new Error('Claude API not properly configured');
    }
    
    try {
      const response = await anthropic.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        messages: [
          {
            role: 'user',
            content: message
          }
        ]
      });
      
      // Extract response text
      let responseText = '';
      if (response.content && response.content.length > 0) {
        for (const contentBlock of response.content) {
          if ('text' in contentBlock) {
            responseText += contentBlock.text;
          }
        }
      }
      
      return responseText;
    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw new Error(`Failed to get response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send a query about code to Claude
   */
  public async sendCodeQuery(prompt: string, code: string, language: string): Promise<string> {
    const message = `${prompt}\n\nHere's the code:\n\`\`\`${language}\n${code}\n\`\`\``;
    return this.sendMessage(message);
  }

  /**
   * Generate code with Claude
   */
  public async generateCode(specification: string, language: string): Promise<string> {
    const message = `Generate ${language} code based on the following specification:\n\n${specification}\n\nPlease write only the code with appropriate comments. Use best practices and design patterns appropriate for ${language}.`;
    return this.sendMessage(message);
  }

  /**
   * Analyze project structure with Claude
   */
  public async analyzeProject(projectStructure: any): Promise<string> {
    const message = `Analyze this project structure and provide insights on the architecture, patterns used, and potential improvements:\n\n\`\`\`json\n${JSON.stringify(projectStructure, null, 2)}\n\`\`\``;
    return this.sendMessage(message);
  }
}