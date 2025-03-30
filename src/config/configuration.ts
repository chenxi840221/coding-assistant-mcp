// Configuration management
import * as vscode from 'vscode';
import { Anthropic } from '@anthropic-ai/sdk';
import { Config, globalState } from '../models/interfaces';

/**
 * Loads the extension configuration from VS Code settings
 */
export function loadConfiguration() {
  const claudeConfig = vscode.workspace.getConfiguration('claudeAssistant');
  
  const config: Config = {
    apiKey: claudeConfig.get('apiKey') || '',
    model: claudeConfig.get('model') || 'claude-3-7-sonnet-20250219',
    maxContextSize: claudeConfig.get('maxContextSize') || 100000,
    maxTokens: claudeConfig.get('maxTokens') || 4000
  };

  // Store in global state
  globalState.config = config;

  // Initialize or update Anthropic client
  if (config.apiKey) {
    globalState.anthropic = new Anthropic({ apiKey: config.apiKey });
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
  return !!globalState.anthropic && !!globalState.config?.apiKey;
}

/**
 * Get the configured Anthropic client
 */
export function getAnthropicClient(): Anthropic | undefined {
  return globalState.anthropic;
}

/**
 * Get the current configuration
 */
export function getConfig(): Config | undefined {
  return globalState.config;
}