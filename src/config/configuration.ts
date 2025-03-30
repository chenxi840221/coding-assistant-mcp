import * as vscode from 'vscode';
import { Anthropic } from '@anthropic-ai/sdk';
import { Config } from '../models/interfaces';
import { globalState } from '../extension'; // Import globalState from extension

export function loadConfiguration() {
  const claudeConfig = vscode.workspace.getConfiguration('claudeAssistant');

  const config: Config = {
    apiKey: claudeConfig.get('apiKey') || '',
    model: claudeConfig.get('model') || 'claude-3-7-sonnet-20250219',
    maxContextSize: claudeConfig.get('maxContextSize') || 100000,
    maxTokens: claudeConfig.get('maxTokens') || 4000,
    maxGeneratedFileLength: claudeConfig.get('maxGeneratedFileLength') || 500
  };

  // Store config in global state
  globalState.config = config;

  // Initialize Anthropic client if API key is present
  if (config.apiKey) {
    globalState.anthropic = new Anthropic({ apiKey: config.apiKey });
  } else {
    vscode.window.showErrorMessage('Claude API key is not set. Please configure it in settings.');
  }
}

export function registerConfigListeners(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('claudeAssistant')) {
        loadConfiguration();
      }
    })
  );
}

export function isClientConfigured(): boolean {
  return !!globalState.anthropic && !!globalState.config?.apiKey;
}

export function getAnthropicClient() {
  return globalState.anthropic;
}

export function getConfig() {
  return globalState.config;
}