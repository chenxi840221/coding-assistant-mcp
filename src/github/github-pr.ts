// src/github/github-pr.ts

import * as vscode from 'vscode';
import { execAsync, getCurrentBranch, isGitRepository, extractRepoInfoFromUrl } from './git-utils';
import { GitHubAuthService } from './github-auth';
import { GitHubRepoService } from './github-repo';

/**
 * Pull request details interface
 */
export interface PullRequestDetails {
  id: number;
  number: number;
  title: string;
  state: string;
  url: string;
  author: string;
  created: string;
  updated: string;
  base: string;
  head: string;
  comments: number;
  changes: {
    additions: number;
    deletions: number;
    files: number;
  };
}

/**
 * Service for pull request operations
 */
export class GitHubPRService {
  private outputChannel: vscode.OutputChannel;
  private authService: GitHubAuthService;
  private repoService: GitHubRepoService;
  private webviewPanel: vscode.WebviewPanel | undefined;

  constructor(
    outputChannel: vscode.OutputChannel,
    authService: GitHubAuthService,
    repoService: GitHubRepoService
  ) {
    this.outputChannel = outputChannel;
    this.authService = authService;
    this.repoService = repoService;
  }

  /**
   * Log a message to the output channel
   */
  private log(level: 'debug' | 'info' | 'warning' | 'error', message: string): void {
    const config = this.authService.getConfig();
    const logLevels = {
      'debug': 0,
      'info': 1,
      'warning': 2,
      'error': 3
    };
    
    // Only log if the message level is >= the configured level
    if (logLevels[level] >= logLevels[config.logLevel || 'info']) {
      const timestamp = new Date().toISOString();
      const prefix = level.toUpperCase().padEnd(7);
      this.outputChannel.appendLine(`[${timestamp}] ${prefix} | ${message}`);
    }
  }

  /**
   * Create a new pull request
   */
  public async createPullRequest(): Promise<boolean> {
    // Check if we have a workspace
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
      vscode.window.showErrorMessage('No workspace is currently open');
      return false;
    }
    
    // Check if it's a git repository
    if (!await isGitRepository(workspacePath)) {
      vscode.window.showErrorMessage('The current workspace is not a Git repository');
      return false;
    }
    
    // Ensure we're authenticated
    if (!this.authService.isAuthenticated()) {
      this.log('info', 'Authentication required to create pull request');
      const authenticated = await this.authService.login(workspacePath);
      if (!authenticated) {
        vscode.window.showErrorMessage('GitHub authentication failed. Cannot create pull request.');
        return false;
      }
    }
    
    // Get PR details from user
    const title = await vscode.window.showInputBox({
      prompt: 'Enter pull request title',
      placeHolder: 'Feature: Add new functionality',
      validateInput: (value) => value ? null : 'Title is required'
    });
    
    if (!title) {
      return false; // User cancelled
    }
    
    const body = await vscode.window.showInputBox({
      prompt: 'Enter pull request description (optional)',
      placeHolder: 'Describe the changes in this pull request',
      value: '## Changes\n\n- \n\n## Testing\n\n- '
    });
    
    // Get current branch
    const headBranch = await getCurrentBranch(workspacePath);
    if (!headBranch) {
      vscode.window.showErrorMessage('Could not determine current branch');
      return false;
    }
    
    // Ask for base branch
    const baseBranch = await vscode.window.showInputBox({
      prompt: 'Enter base branch (target for PR)',
      placeHolder: 'main',
      value: 'main'
    });
    
    if (!baseBranch) {
      return false; // User cancelled
    }
    
    // Create the PR
    return await this.repoService.createPullRequest({
      title,
      body: body || undefined,
      baseBranch,
      headBranch
    });
  }

  /**
   * List pull requests for the current repository
   */
  public async listPullRequests(): Promise<void> {
    // Check if we have a workspace
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
      vscode.window.showErrorMessage('No workspace is currently open');
      return;
    }
    
    // Check if it's a git repository
    if (!await isGitRepository(workspacePath)) {
      vscode.window.showErrorMessage('The current workspace is not a Git repository');
      return;
    }
    
    // Ensure we're authenticated
    if (!this.authService.isAuthenticated()) {
      this.log('info', 'Authentication required to list pull requests');
      const authenticated = await this.authService.login(workspacePath);
      if (!authenticated) {
        vscode.window.showErrorMessage('GitHub authentication failed. Cannot list pull requests.');
        return;
      }
    }
    
    try {
      // Get repository URL
      const repoUrl = await this.repoService.getCurrentRepoUrl();
      if (!repoUrl) {
        vscode.window.showErrorMessage('Could not determine repository URL');
        return;
      }
      
      // Extract owner and repo
      const repoInfo = extractRepoInfoFromUrl(repoUrl);
      if (!repoInfo) {
        vscode.window.showErrorMessage('Could not parse GitHub repository info from URL');
        return;
      }
      
      // Show progress indicator
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Fetching pull requests',
        cancellable: false
      }, async (progress) => {
        try {
          // Get auth token
          const config = this.authService.getConfig();
          const token = config.personalAccessToken;
          
          if (!token) {
            vscode.window.showErrorMessage('GitHub token not found');
            return;
          }
          
          // Fetch PRs from GitHub API
          progress.report({ message: 'Connecting to GitHub API...' });
          
          const axios = require('axios');
          const response = await axios.get(
            `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/pulls?state=all`, 
            {
              headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${token}`,
                'User-Agent': 'Claude-Coding-Assistant'
              }
            }
          );
          
          // Parse response
          const pullRequests: PullRequestDetails[] = await Promise.all(
            response.data.map(async (pr: any) => {
              // Fetch PR details including changes
              const detailsResponse = await axios.get(
                pr.url,
                {
                  headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'Authorization': `token ${token}`,
                    'User-Agent': 'Claude-Coding-Assistant'
                  }
                }
              );
              
              return {
                id: pr.id,
                number: pr.number,
                title: pr.title,
                state: pr.state,
                url: pr.html_url,
                author: pr.user.login,
                created: new Date(pr.created_at).toLocaleString(),
                updated: new Date(pr.updated_at).toLocaleString(),
                base: pr.base.ref,
                head: pr.head.ref,
                comments: pr.comments,
                changes: {
                  additions: detailsResponse.data.additions || 0,
                  deletions: detailsResponse.data.deletions || 0,
                  files: detailsResponse.data.changed_files || 0
                }
              };
            })
          );
          
          // Display PRs in webview
          this.showPullRequestsWebview(pullRequests, repoInfo.owner, repoInfo.repo);
        } catch (error: any) {
          if (error.response) {
            vscode.window.showErrorMessage(
              `GitHub API error: ${error.response.data.message || 'Unknown error'}`
            );
          } else {
            vscode.window.showErrorMessage(
              `Error fetching pull requests: ${error.message || 'Unknown error'}`
            );
          }
        }
      });
    } catch (error) {
      this.log('error', `Error listing pull requests: ${error instanceof Error ? error.message : String(error)}`);
      vscode.window.showErrorMessage(`Failed to list pull requests: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Show pull requests in a webview
   */
  private showPullRequestsWebview(pullRequests: PullRequestDetails[], owner: string, repo: string): void {
    if (!this.webviewPanel) {
      this.webviewPanel = vscode.window.createWebviewPanel(
        'githubPullRequests',
        'GitHub Pull Requests',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );
      
      this.webviewPanel.onDidDispose(() => {
        this.webviewPanel = undefined;
      });
    } else {
      this.webviewPanel.reveal();
    }
    
    this.webviewPanel.webview.html = this.getPullRequestsHtml(pullRequests, owner, repo);
    
    // Handle messages from the webview
    this.webviewPanel.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'openPR':
          vscode.env.openExternal(vscode.Uri.parse(message.url));
          break;
        case 'refresh':
          this.listPullRequests();
          break;
      }
    });
  }

  /**
   * Generate HTML for the pull requests webview
   */
  private getPullRequestsHtml(pullRequests: PullRequestDetails[], owner: string, repo: string): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GitHub Pull Requests</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                padding: 0;
                margin: 0;
                color: var(--vscode-editor-foreground);
                background-color: var(--vscode-editor-background);
            }
            
            .header {
                padding: 10px;
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                border-bottom: 1px solid var(--vscode-panel-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .repo-info {
                font-size: 14px;
                margin-bottom: 5px;
            }
            
            .pr-list {
                padding: 10px;
                overflow-y: auto;
                height: calc(100vh - 80px);
            }
            
            .pr-item {
                margin-bottom: 12px;
                padding: 12px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                cursor: pointer;
            }
            
            .pr-item:hover {
                background-color: var(--vscode-list-hoverBackground);
            }
            
            .pr-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
            }
            
            .pr-title {
                font-weight: bold;
                font-size: 16px;
            }
            
            .pr-number {
                font-family: monospace;
                color: var(--vscode-descriptionForeground);
            }
            
            .pr-meta {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-bottom: 8px;
                font-size: 12px;
            }
            
            .pr-meta-item {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .pr-state {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
            }
            
            .pr-state.open {
                background-color: #28a745;
                color: white;
            }
            
            .pr-state.closed {
                background-color: #d73a49;
                color: white;
            }
            
            .pr-state.merged {
                background-color: #6f42c1;
                color: white;
            }
            
            .pr-branches {
                display: flex;
                gap: 6px;
                align-items: center;
                margin-bottom: 8px;
                font-family: monospace;
                font-size: 12px;
            }
            
            .branch-label {
                padding: 2px 6px;
                background-color: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                border-radius: 4px;
            }
            
            .changes {
                display: flex;
                gap: 10px;
                font-size: 12px;
            }
            
            .additions {
                color: #28a745;
            }
            
            .deletions {
                color: #d73a49;
            }
            
            button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 6px 12px;
                border-radius: 2px;
                cursor: pointer;
            }
            
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            
            .empty-state {
                text-align: center;
                margin-top: 50px;
                padding: 20px;
                color: var(--vscode-descriptionForeground);
            }
            
            .empty-state p {
                margin: 10px 0;
            }
            
            .empty-state button {
                margin-top: 15px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <h2>Pull Requests</h2>
                <div class="repo-info">${owner}/${repo}</div>
            </div>
            <button id="refreshButton">Refresh</button>
        </div>
        
        <div class="pr-list">
            ${pullRequests.length === 0 ? 
              `<div class="empty-state">
                <p>No pull requests found for this repository.</p>
                <p>Create a new branch and make changes to start a pull request.</p>
                <button id="createPrButton">Create Pull Request</button>
              </div>` :
              pullRequests.map(pr => `
                <div class="pr-item" data-url="${pr.url}">
                    <div class="pr-header">
                        <div class="pr-title">${this.escapeHtml(pr.title)}</div>
                        <div class="pr-number">#${pr.number}</div>
                    </div>
                    <div class="pr-meta">
                        <div class="pr-meta-item">
                            <span>Author: ${pr.author}</span>
                        </div>
                        <div class="pr-meta-item">
                            <span class="pr-state ${pr.state}">${pr.state}</span>
                        </div>
                        <div class="pr-meta-item">
                            <span>Created: ${pr.created}</span>
                        </div>
                        <div class="pr-meta-item">
                            <span>Updated: ${pr.updated}</span>
                        </div>
                    </div>
                    <div class="pr-branches">
                        <span class="branch-label">${pr.head}</span>
                        <span>→</span>
                        <span class="branch-label">${pr.base}</span>
                    </div>
                    <div class="changes">
                        <div class="pr-meta-item">
                            <span>Changed files: ${pr.changes.files}</span>
                        </div>
                        <div class="pr-meta-item additions">
                            <span>+${pr.changes.additions}</span>
                        </div>
                        <div class="pr-meta-item deletions">
                            <span>-${pr.changes.deletions}</span>
                        </div>
                    </div>
                </div>
              `).join('')
            }
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            
            // Add click listeners to PR items
            document.querySelectorAll('.pr-item').forEach(item => {
                item.addEventListener('click', () => {
                    const url = item.getAttribute('data-url');
                    vscode.postMessage({
                        command: 'openPR',
                        url: url
                    });
                });
            });
            
            // Refresh button
            document.getElementById('refreshButton').addEventListener('click', () => {
                vscode.postMessage({ command: 'refresh' });
            });
            
            // Create PR button (if present)
            const createPrButton = document.getElementById('createPrButton');
            if (createPrButton) {
                createPrButton.addEventListener('click', () => {
                    vscode.postMessage({ command: 'createPR' });
                });
            }
        </script>
    </body>
    </html>`;
  }

  /**
   * Helper function to escape HTML
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}