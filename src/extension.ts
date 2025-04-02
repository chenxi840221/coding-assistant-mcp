import * as vscode from 'vscode';
import { loadConfiguration } from './config/configuration';
import { setupChatCommands, setWebViewManager } from './chat/chat-manager';
import { setupCodeAssistantCommands } from './code-assistant/code-assistant';
import { setupProjectAnalyzer } from './code-assistant/project-analyzer';
import { WebViewManager } from './chat/chat-view';
import { getGitHubService } from './github/github-service';
import { initializeVectorStore } from './chat/vector-store';
import { registerGitHubPanel } from './github/github-panel';

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

  // Initialize vector store
  initializeVectorStore(context).catch(error => {
    console.error('Failed to initialize vector store:', error);
  });

  // Register commands for chat interface
  setupChatCommands(context);
  
  // Register commands for code assistance
  setupCodeAssistantCommands(context);
  
  // Set up project analyzer
  setupProjectAnalyzer(context);
  
  // Register GitHub integration commands
  registerGitHubCommands(context);
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
  
  // Add commands to subscriptions
  context.subscriptions.push(
    cloneCommand, 
    pushCommand, 
    setRepoUrlCommand, 
    showCommitHistoryCommand, 
    listPullRequestsCommand,
    createPullRequestCommand
  );
}

export function deactivate() {
  // Clean up resources
  if (globalState.webViewManager) {
    globalState.webViewManager.dispose();
  }
  
  console.log('Claude Coding Assistant has been deactivated');
}