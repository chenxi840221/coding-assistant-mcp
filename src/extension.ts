import * as vscode from 'vscode';
import { loadConfiguration } from './config/configuration';
import { setupChatCommands, setWebViewManager } from './chat/chat-manager';
import { setupCodeAssistantCommands } from './code-assistant/code-assistant';
import { setupProjectAnalyzer } from './code-assistant/project-analyzer';
import { WebViewManager } from './chat/chat-view';

// Store global state
export let globalState: {
  context?: vscode.ExtensionContext;
  webViewManager?: WebViewManager;
} = {};

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Coding Assistant is now active');

  // Store extension context for use across modules
  globalState.context = context;
  
  // Initialize the WebView manager
  globalState.webViewManager = new WebViewManager(context);
  
  // Share the WebView manager with chat manager
  setWebViewManager(globalState.webViewManager);

  // Load configuration and initialize API clients
  loadConfiguration();

  // Register commands for chat interface
  setupChatCommands(context);
  
  // Register commands for code assistance
  setupCodeAssistantCommands(context);
  
  // Set up project analyzer
  setupProjectAnalyzer(context);
}

export function deactivate() {
  // Clean up resources
  if (globalState.webViewManager) {
    globalState.webViewManager.dispose();
  }
  
  console.log('Claude Coding Assistant has been deactivated');
}