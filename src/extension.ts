import * as vscode from 'vscode';
import { loadConfiguration, registerConfigListeners } from './config/configuration';
import { setupChatCommands, setWebViewManager } from './chat/chat-manager';
import { setupCodeAssistantCommands } from './code-assistant/code-assistant';
import { setupProjectAnalyzer } from './code-assistant/project-analyzer';
import { WebViewManager } from './chat/chat-view';
import { EnhancedChatViewManager } from './chat/enhanced-chat-view';
import { getGitHubService } from './github/github-service';
import { initializeVectorStore } from './chat/vector-store';
import { registerGitHubPanel } from './github/github-panel';
import { getCodeFileManager } from './utils/code-file-manager';

// Store global state
export let globalState: {
  context?: vscode.ExtensionContext;
  webViewManager?: WebViewManager;
  enhancedChatViewManager?: EnhancedChatViewManager;
} = {};

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Coding Assistant is now active');

  // Store extension context for use across modules
  globalState.context = context;
  
  // Initialize the WebView managers
  globalState.webViewManager = new WebViewManager(context);
  globalState.enhancedChatViewManager = new EnhancedChatViewManager(context);
  
  // Share the WebView manager with chat manager
  setWebViewManager(globalState.webViewManager);

  // Load configuration and initialize API clients
  loadConfiguration();
  
  // Register config change listeners
  registerConfigListeners(context);

  // Initialize vector store
  initializeVectorStore(context).catch(error => {
    console.error('Failed to initialize vector store:', error);
  });

  // Initialize code file manager
  getCodeFileManager();

  // Register commands for chat interface
  setupChatCommands(context);
  
  // Register direct chat command (for debugging)
  const openChatViewDirectCommand = vscode.commands.registerCommand(
    'claudeAssistant.openChatViewDirect', 
    () => {
      console.log('Direct chat command triggered');
      if (globalState.webViewManager) {
        globalState.webViewManager.openChatView();
      } else {
        console.error('WebView manager not initialized!');
        vscode.window.showErrorMessage('WebView manager not initialized. Try reloading the window.');
      }
    }
  );
  context.subscriptions.push(openChatViewDirectCommand);
  
  // Register command for enhanced chat view
  const openEnhancedChatCommand = vscode.commands.registerCommand(
    'claudeAssistant.openEnhancedChat',
    () => {
      console.log('Enhanced chat command triggered');
      if (globalState.enhancedChatViewManager) {
        globalState.enhancedChatViewManager.openChatView();
      } else {
        console.error('Enhanced chat view manager not initialized!');
        vscode.window.showErrorMessage('Enhanced chat view manager not initialized. Try reloading the window.');
      }
    }
  );
  context.subscriptions.push(openEnhancedChatCommand);
  
  // Register unified code-assistant command
  const unifiedCodeAssistantCommand = vscode.commands.registerCommand(
    'claudeAssistant.unifiedCodeAssistant',
    () => {
      console.log('Unified code assistant command triggered');
      if (globalState.enhancedChatViewManager) {
        globalState.enhancedChatViewManager.openChatView();
      } else {
        console.error('Enhanced chat view manager not initialized!');
        vscode.window.showErrorMessage('Enhanced chat view manager not initialized. Try reloading the window.');
      }
    }
  );
  context.subscriptions.push(unifiedCodeAssistantCommand);
  
  // Register commands for code assistance
  setupCodeAssistantCommands(context);
  
  // Set up project analyzer
  setupProjectAnalyzer(context);
  
  // Register GitHub integration commands
  registerGitHubCommands(context);
  
  // Register editor context tracking
  registerEditorContextTracking(context);
  
  console.log('All commands registered');
}

/**
 * Register GitHub integration commands
 */
function registerGitHubCommands(context: vscode.ExtensionContext) {
  // Clone repository command
  const cloneCommand = vscode.commands.registerCommand(
    'claudeAssistant.cloneRepository',
    async () => {
      const githubService = getGitHubService();
      await githubService.cloneRepository();
    }
  );
  
  // Push changes command
  const pushCommand = vscode.commands.registerCommand(
    'claudeAssistant.pushChanges',
    async () => {
      const githubService = getGitHubService();
      await githubService.pushChanges();
    }
  );
  
  // Push changes with selection command
  const pushChangesWithSelectionCommand = vscode.commands.registerCommand(
    'claudeAssistant.pushChangesWithSelection',
    async () => {
      const githubService = getGitHubService();
      await githubService.pushChangesWithSelection();
    }
  );
  
  // Set repository URL command
  const setRepoUrlCommand = vscode.commands.registerCommand(
    'claudeAssistant.setRepositoryUrl',
    async () => {
      const githubService = getGitHubService();
      // Get current URL as default
      const currentUrl = await githubService.getCurrentRepoUrl() || '';
      
      // Prompt user for new URL
      const newUrl = await vscode.window.showInputBox({
        prompt: 'Enter GitHub repository URL',
        placeHolder: 'https://github.com/username/repository.git',
        value: currentUrl
      });
      
      if (newUrl) {
        await githubService.setRepositoryUrl(newUrl);
      }
    }
  );

  // Register the GitHub panel
  registerGitHubPanel(context);
  
  // Register GitHub integration commands
  const showCommitHistoryCommand = vscode.commands.registerCommand(
    'claudeAssistant.showCommitHistory',
    async () => {
      const githubService = getGitHubService();
      await githubService.showCommitHistory();
    }
  );
  
  const listPullRequestsCommand = vscode.commands.registerCommand(
    'claudeAssistant.listPullRequests',
    async () => {
      const githubService = getGitHubService();
      await githubService.listPullRequests();
    }
  );
  
  const createPullRequestCommand = vscode.commands.registerCommand(
    'claudeAssistant.createPullRequest',
    async () => {
      const githubService = getGitHubService();
      await githubService.createPullRequest();
    }
  );
  
  // Show GitHub logs command
  const showGitHubLogsCommand = vscode.commands.registerCommand(
    'claudeAssistant.showGitHubLogs',
    () => {
      const githubService = getGitHubService();
      githubService.showLogs();
    }
  );
  
  // Clear GitHub logs command
  const clearGitHubLogsCommand = vscode.commands.registerCommand(
    'claudeAssistant.clearGitHubLogs',
    () => {
      const githubService = getGitHubService();
      githubService.clearLogs();
    }
  );

  // Add commands to subscriptions
  context.subscriptions.push(
    cloneCommand, 
    pushCommand, 
    pushChangesWithSelectionCommand,
    setRepoUrlCommand, 
    showCommitHistoryCommand, 
    listPullRequestsCommand,
    createPullRequestCommand,
    showGitHubLogsCommand,
    clearGitHubLogsCommand
  );
}

/**
 * Register tracking of editor context for enhanced chat
 */
function registerEditorContextTracking(context: vscode.ExtensionContext) {
  // Track active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && globalState.enhancedChatViewManager) {
        // Update enhanced chat with editor context
        globalState.enhancedChatViewManager.updateEditorContext(editor);
      }
    })
  );
  
  // Track selection changes
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(event => {
      if (event.textEditor && globalState.enhancedChatViewManager) {
        // Update enhanced chat with selection context
        globalState.enhancedChatViewManager.updateSelectionContext(event.textEditor);
      }
    })
  );
  
  // Track document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === event.document && globalState.enhancedChatViewManager) {
        // Update enhanced chat with document changes
        globalState.enhancedChatViewManager.updateDocumentContext(editor);
      }
    })
  );
  
  // Register command to insert text at cursor
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeAssistant.insertAtCursor', (text: string) => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        editor.edit(editBuilder => {
          editBuilder.insert(editor.selection.active, text);
        });
      }
    })
  );
}

export function deactivate() {
  // Clean up resources
  if (globalState.webViewManager) {
    globalState.webViewManager.dispose();
  }
  
  if (globalState.enhancedChatViewManager) {
    globalState.enhancedChatViewManager.dispose();
  }
  
  console.log('Claude Coding Assistant has been deactivated');
}