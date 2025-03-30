import * as vscode from 'vscode';
import { Anthropic } from '@anthropic-ai/sdk';
import { Config } from '../models/interfaces';

// Global client and configuration
let anthropicClient: Anthropic | undefined;
let extensionConfig: Config | undefined;

/**
 * Loads the extension configuration from VS Code settings
 */
export function loadConfiguration() {
  const claudeConfig = vscode.workspace.getConfiguration('claudeAssistant');
  
  extensionConfig = {
    apiKey: claudeConfig.get('apiKey') || '',
    model: claudeConfig.get('model') || 'claude-3-7-sonnet-20250219',
    maxContextSize: claudeConfig.get('maxContextSize') || 100000,
    maxTokens: claudeConfig.get('maxTokens') || 4000,
    maxGeneratedFileLength: claudeConfig.get('maxGeneratedFileLength') || 500
  };

  // Initialize or update Anthropic client
  if (extensionConfig.apiKey) {
    anthropicClient = new Anthropic({ apiKey: extensionConfig.apiKey });
  } else {
    vscode.window.showErrorMessage('Claude API key is not set. Please configure it in settings.');
  }
}

/**
 * Register listeners for configuration changes
 */
export function registerConfigListeners(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('claudeAssistant')) {
      loadConfiguration();
    }
  }));
}

/**
 * Check if the client is properly configured
 */
export function isClientConfigured(): boolean {
  return !!anthropicClient && !!extensionConfig?.apiKey;
}

/**
 * Get the configured Anthropic client
 */
export function getAnthropicClient(): Anthropic | undefined {
  return anthropicClient;
}

/**
 * Get the current configuration
 */
export function getConfig(): Config | undefined {
  return extensionConfig;
}

/**
 * Get the maximum file length setting
 */
export function getMaxFileLength(): number {
  return extensionConfig?.maxGeneratedFileLength || 500;
}