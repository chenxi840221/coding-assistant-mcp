// src/github/github-panel.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { getGitHubService } from './github-service';

/**
 * Provider for the GitHub repository panel
 */
export class GitHubPanelProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Resolve the webview view
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      const githubService = getGitHubService();
      
      switch (message.command) {
        case 'login':
          try {
            const success = await githubService.login();
            
            // Send authentication status back to webview
            const repoInfo = await githubService.getRepositoryInfo();
            
            this.view?.webview.postMessage({
              type: 'authStatus',
              isAuthenticated: success,
              username: repoInfo.username || '',
              loginMessage: success 
                ? `Successfully authenticated${repoInfo.username ? ` as ${repoInfo.username}` : ''}`
                : 'Authentication failed. Please try again.'
            });
            
            // Refresh repository info
            this.refreshRepositoryInfo();
          } catch (error) {
            // Handle error
            this.view?.webview.postMessage({
              type: 'authStatus',
              isAuthenticated: false,
              loginMessage: 'Authentication error. Please try again.'
            });
          }
          break;
          
        case 'cloneRepository':
          try {
            await githubService.cloneRepository();
          } catch (error) {
            this.view?.webview.postMessage({
              type: 'authStatus',
              loginMessage: 'Failed to clone repository. Please check logs.'
            });
          }
          break;
          
        case 'pushChanges':
          try {
            await githubService.pushChanges();
            this.refreshRepositoryInfo();
          } catch (error) {
            this.view?.webview.postMessage({
              type: 'authStatus',
              loginMessage: 'Failed to push changes. Please check logs.'
            });
          }
          break;
          
        case 'refreshInfo':
          this.refreshRepositoryInfo();
          break;
          
        case 'setRepositoryUrl':
          if (message.url) {
            try {
              await githubService.setRepositoryUrl(message.url);
              this.refreshRepositoryInfo();
            } catch (error) {
              this.view?.webview.postMessage({
                type: 'authStatus',
                loginMessage: 'Failed to set repository URL. Please check logs.'
              });
            }
          }
          break;
        
        case 'showCommitHistory':
          try {
            await githubService.showCommitHistory();
          } catch (error) {
            this.view?.webview.postMessage({
              type: 'authStatus',
              loginMessage: 'Failed to show commit history. Please check logs.'
            });
          }
          break;
          
        case 'listPullRequests':
          try {
            await githubService.listPullRequests();
          } catch (error) {
            this.view?.webview.postMessage({
              type: 'authStatus',
              loginMessage: 'Failed to list pull requests. Please check logs.'
            });
          }
          break;
          
        case 'createPullRequest':
          try {
            await githubService.createPullRequest();
          } catch (error) {
            this.view?.webview.postMessage({
              type: 'authStatus',
              loginMessage: 'Failed to create pull request. Please check logs.'
            });
          }
          break;
      }
    });

    // Initial refresh of repository info
    this.refreshRepositoryInfo();
  }

  /**
   * Refresh repository information
   */
  private async refreshRepositoryInfo() {
    if (!this.view) {
      return;
    }

    try {
      // Get repository information from GitHub service
      const githubService = getGitHubService();
      const repoInfo = await githubService.getRepositoryInfo();

      // Send the info to the webview
      this.view.webview.postMessage({
        type: 'updateRepoInfo',
        data: repoInfo
      });
    } catch (error) {
      console.error('Error refreshing repository info:', error);
    }
  }

  /**
   * Get HTML for the webview
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GitHub Integration</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                padding: 0 20px;
                background-color: var(--vscode-editor-background);
            }
            
            button {
                display: inline-block;
                padding: 8px 12px;
                margin: 8px 0;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 2px;
                cursor: pointer;
                width: 100%;
                text-align: left;
            }
            
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            
            button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            
            .repo-info {
                margin-top: 20px;
                border-top: 1px solid var(--vscode-panel-border);
                padding-top: 10px;
            }
            
            .repo-info h3 {
                margin-bottom: 5px;
            }
            
            .repo-info p {
                margin: 5px 0;
            }
            
            .status {
                display: inline-block;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                margin-right: 5px;
            }
            
            .status.modified {
                background-color: orange;
            }
            
            .status.clean {
                background-color: green;
            }
            
            .status.authenticated {
                background-color: #4CAF50;
            }
            
            .status.unauthenticated {
                background-color: #F44336;
            }
            
            .auth-status {
                display: flex;
                align-items: center;
                margin-top: 5px;
                font-size: 12px;
                padding: 8px;
                border-radius: 4px;
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                margin-bottom: 10px;
            }
            
            .auth-status.authenticated {
                background-color: rgba(76, 175, 80, 0.2);
            }
            
            .auth-status.unauthenticated {
                background-color: rgba(244, 67, 54, 0.1);
            }
            
            .section {
                margin-bottom: 15px;
            }
            
            .badge {
                background-color: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 12px;
                margin-left: 5px;
            }
            
            .action-buttons {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .action-button {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .action-button span {
                margin-left: 5px;
            }
            
            .url-container {
                margin-top: 15px;
                margin-bottom: 15px;
            }
            
            .url-input {
                width: 100%;
                padding: 6px;
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 2px;
                margin-bottom: 5px;
            }
            
            .url-actions {
                display: flex;
                gap: 5px;
            }
            
            .url-actions button {
                margin: 0;
                flex: 1;
            }
            
            .note {
                font-size: 12px;
                font-style: italic;
                margin-top: 5px;
                opacity: 0.8;
            }
            
            .login-info {
                font-size: 12px;
                margin-top: 5px;
                font-weight: bold;
            }
            
            .loading {
                opacity: 0.5;
                pointer-events: none;
            }
            
            .action-group {
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                padding: 10px;
                margin-bottom: 15px;
            }
            
            .action-group-title {
                font-weight: bold;
                margin-bottom: 8px;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="section">
            <h2>GitHub Integration</h2>
            
            <div id="authStatusContainer" class="auth-status unauthenticated">
                <span class="status unauthenticated"></span>
                <span id="authStatusText">Not authenticated with GitHub</span>
            </div>
            
            <div class="action-group">
                <div class="action-group-title">Authentication</div>
                <button id="loginBtn" title="Login to GitHub">
                    <div class="action-button">
                        <span>$(key)</span>
                        <span>Login to GitHub</span>
                    </div>
                </button>
                <p id="loginInfo" class="login-info"></p>
            </div>
            
            <div class="action-group">
                <div class="action-group-title">Repository Settings</div>
                <div class="url-container">
                    <label for="repoUrl">Repository URL:</label>
                    <input id="repoUrl" class="url-input" type="text" placeholder="https://github.com/username/repository.git">
                    <div class="url-actions">
                        <button id="setUrlBtn" title="Set/Change repository URL">
                            <div class="action-button">
                                <span>$(repo)</span>
                                <span>Set URL</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="action-group">
                <div class="action-group-title">Repository Actions</div>
                <div class="action-buttons">
                    <button id="cloneBtn" title="Clone a GitHub repository">
                        <div class="action-button">
                            <span>$(repo-clone)</span>
                            <span>Clone Repository</span>
                        </div>
                    </button>
                    <button id="pushBtn" title="Push changes to GitHub" disabled>
                        <div class="action-button">
                            <span>$(repo-push)</span>
                            <span>Push Changes</span>
                        </div>
                    </button>
                    <button id="commitHistoryBtn" title="View commit history">
                        <div class="action-button">
                            <span>$(git-commit)</span>
                            <span>Commit History</span>
                        </div>
                    </button>
                    <button id="pullRequestsBtn" title="View pull requests">
                        <div class="action-button">
                            <span>$(git-pull-request)</span>
                            <span>Pull Requests</span>
                        </div>
                    </button>
                    <button id="createPrBtn" title="Create a new pull request">
                        <div class="action-button">
                            <span>$(diff-added)</span>
                            <span>Create Pull Request</span>
                        </div>
                    </button>
                    <button id="refreshBtn" title="Refresh repository information">
                        <div class="action-button">
                            <span>$(refresh)</span>
                            <span>Refresh Info</span>
                        </div>
                    </button>
                </div>
                <p class="note">Repository analysis runs automatically after clone and push operations</p>
            </div>
        </div>
        
        <div id="repoInfo" class="repo-info">
            <h3>Repository Information</h3>
            <div id="repoContent">
                <p>No repository detected</p>
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            let isLoading = false;
            
            // Buttons
            document.getElementById('loginBtn').addEventListener('click', () => {
                setLoading(true);
                vscode.postMessage({ command: 'login' });
            });
            
            document.getElementById('cloneBtn').addEventListener('click', () => {
                setLoading(true);
                vscode.postMessage({ command: 'cloneRepository' });
            });
            
            document.getElementById('pushBtn').addEventListener('click', () => {
                setLoading(true);
                vscode.postMessage({ command: 'pushChanges' });
            });
            
            document.getElementById('refreshBtn').addEventListener('click', () => {
                setLoading(true);
                vscode.postMessage({ command: 'refreshInfo' });
            });
            
            document.getElementById('setUrlBtn').addEventListener('click', () => {
                const repoUrl = document.getElementById('repoUrl').value.trim();
                if (repoUrl) {
                    setLoading(true);
                    vscode.postMessage({ 
                        command: 'setRepositoryUrl',
                        url: repoUrl
                    });
                }
            });
            
            document.getElementById('commitHistoryBtn').addEventListener('click', () => {
                vscode.postMessage({ command: 'showCommitHistory' });
            });
            
            document.getElementById('pullRequestsBtn').addEventListener('click', () => {
                vscode.postMessage({ command: 'listPullRequests' });
            });
            
            document.getElementById('createPrBtn').addEventListener('click', () => {
                vscode.postMessage({ command: 'createPullRequest' });
            });
            
            // Set loading state
            function setLoading(loading) {
                isLoading = loading;
                
                const buttons = document.querySelectorAll('button');
                buttons.forEach(button => {
                    button.disabled = loading;
                });
                
                document.body.classList.toggle('loading', loading);
                
                if (loading) {
                    document.getElementById('loginInfo').textContent = 'Processing request...';
                } else {
                    document.getElementById('loginInfo').textContent = '';
                }
            }
            
            // Update authentication status UI
            function updateAuthStatus(isAuthenticated, username) {
                const container = document.getElementById('authStatusContainer');
                const statusText = document.getElementById('authStatusText');
                const pushBtn = document.getElementById('pushBtn');
                
                if (isAuthenticated) {
                    container.className = 'auth-status authenticated';
                    statusText.textContent = username ? 
                        'Authenticated as ' + username : 
                        'Authenticated with GitHub';
                    pushBtn.disabled = false;
                } else {
                    container.className = 'auth-status unauthenticated';
                    statusText.textContent = 'Not authenticated with GitHub';
                    pushBtn.disabled = true;
                }
            }
            
            // Handle messages from the extension
            window.addEventListener('message', event => {
                const message = event.data;
                setLoading(false);
                
                if (message.type === 'updateRepoInfo') {
                    updateRepositoryInfo(message.data);
                    
                    // Update the URL input field if URL is available
                    if (message.data.remote && message.data.remote !== 'No remote configured') {
                        document.getElementById('repoUrl').value = message.data.remote;
                    }
                    
                    // Update authentication status
                    updateAuthStatus(
                        message.data.isAuthenticated || false,
                        message.data.username || ''
                    );
                }
                
                if (message.type === 'authStatus') {
                    updateAuthStatus(
                        message.isAuthenticated || false,
                        message.username || ''
                    );
                    
                    if (message.loginMessage) {
                        document.getElementById('loginInfo').textContent = message.loginMessage;
                    }
                }
            });
            
            function updateRepositoryInfo(repoInfo) {
                const repoContent = document.getElementById('repoContent');
                
                if (!repoInfo.isRepo) {
                    repoContent.innerHTML = '<p>No repository detected</p>';
                    return;
                }
                
                const statusClass = repoInfo.hasChanges ? 'modified' : 'clean';
                const statusText = repoInfo.hasChanges ? 'Modified' : 'Clean';
                
                repoContent.innerHTML = \`
                    <p><strong>Name:</strong> \${repoInfo.name}</p>
                    <p><strong>Branch:</strong> \${repoInfo.branch}</p>
                    <p><strong>Remote:</strong> \${repoInfo.remote}</p>
                    <p><strong>Last Commit:</strong> \${repoInfo.lastCommit}</p>
                    <p>
                        <strong>Status:</strong> 
                        <span class="status \${statusClass}"></span>
                        \${statusText}
                    </p>
                \`;
            }
        </script>
    </body>
    </html>`;
  }
}

/**
 * Register the GitHub panel
 */
export function registerGitHubPanel(context: vscode.ExtensionContext) {
  // Register the GitHub panel provider
  const gitHubPanelProvider = new GitHubPanelProvider(context);
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'claude-github',
      gitHubPanelProvider
    )
  );
}