// Configuration management
import * as vscode from 'vscode';
import { Anthropic } from '@anthropic-ai/sdk';
import { Config, globalState } from '../models/interfaces';

/**
 * Loads the extension configuration from VS Code settings
 */
export function loadConfiguration() {
  console.log('Loading extension configuration');
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
    console.log(`API key found, initializing Anthropic client with model: ${config.model}`);
    globalState.anthropic = new Anthropic({ apiKey: config.apiKey });
  } else {
    console.warn('Claude API key is not set. Please configure it in settings.');
    vscode.window.showErrorMessage('Claude API key is not set. Please configure it in settings.');
  }
}

/**
 * Register listeners for configuration changes
 */
/**
 * Register listeners for configuration changes
 */
export function registerConfigListeners(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('claudeAssistant')) {
      console.log('Configuration changed, reloading');
      loadConfiguration();
    }
  }));
}

/**
 * Check if the client is properly configured
 */
export function isClientConfigured(): boolean {
  console.log('Checking if client is configured');
  const isConfigured = !!globalState.anthropic && !!globalState.config?.apiKey;
  console.log(`Client configured: ${isConfigured}`);
  return isConfigured;
}

/**
 * Get the configured Anthropic client
 */
export function getAnthropicClient(): Anthropic | undefined {
  if (!globalState.anthropic) {
    console.warn('Anthropic client not initialized');
  }
  return globalState.anthropic;
}

/**
 * Get the current configuration
 */
export function getConfig(): Config | undefined {
  if (!globalState.config) {
    console.warn('Configuration not loaded');
  }
  return globalState.config;
}