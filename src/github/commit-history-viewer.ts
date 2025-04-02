// src/github/commit-history-viewer.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { execAsync } from './git-utils';

/**
 * Interface for commit information
 */
export interface Commit {
  hash: string;
  shortHash: string;
  date: string;
  author: string;
  email: string;
  message: string;
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
}

/**
 * Class to handle commit history visualization
 */
export class CommitHistoryViewer {
  private readonly outputChannel: vscode.OutputChannel;
  private webviewPanel: vscode.WebviewPanel | undefined;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('GitHub Commit History');
  }

  /**
   * Get commit history for the current repository
   */
  public async getCommitHistory(workspacePath: string, limit: number = 50): Promise<Commit[]> {
    try {
      // Use git log to get commit history with stats
      const { stdout } = await execAsync(
        `git log -${limit} --pretty=format:"%H|%h|%ad|%an|%ae|%s" --date=short --numstat`,
        { cwd: workspacePath }
      );

      const commits: Commit[] = [];
      const lines = stdout.split('\n');

      let currentCommit: Partial<Commit> | undefined;
      let stats = { filesChanged: 0, insertions: 0, deletions: 0 };

      for (const line of lines) {
        if (line.includes('|')) {
          // Save previous commit if exists
          if (currentCommit) {
            commits.push({
              ...currentCommit as Commit,
              filesChanged: stats.filesChanged,
              insertions: stats.insertions,
              deletions: stats.deletions
            });
          }

          // Start new commit
          const [hash, shortHash, date, author, email, message] = line.split('|');
          currentCommit = { hash, shortHash, date, author, email, message };
          stats = { filesChanged: 0, insertions: 0, deletions: 0 };
        } else if (line.trim() && currentCommit) {
          // Parse numstat line
          const parts = line.trim().split('\t');
          if (parts.length >= 3) {
            const insertions = parseInt(parts[0]) || 0;
            const deletions = parseInt(parts[1]) || 0;
            stats.filesChanged++;
            stats.insertions += insertions;
            stats.deletions += deletions;
          }
        }
      }

      // Add the last commit
      if (currentCommit) {
        commits.push({
          ...currentCommit as Commit,
          filesChanged: stats.filesChanged,
          insertions: stats.insertions,
          deletions: stats.deletions
        });
      }

      return commits;
    } catch (error) {
      console.error('Error getting commit history:', error);
      return [];
    }
  }

  /**
   * Show commit history in a webview panel
   */
  public async showCommitHistory(workspacePath: string): Promise<void> {
    try {
      const commits = await this.getCommitHistory(workspacePath);

      // Create and show panel
      if (!this.webviewPanel) {
        this.webviewPanel = vscode.window.createWebviewPanel(
          'commitHistory',
          'Git Commit History',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true
          }
        );

        // Handle panel disposal
        this.webviewPanel.onDidDispose(() => {
          this.webviewPanel = undefined;
        });
      } else {
        this.webviewPanel.reveal();
      }

      // Set HTML content
      this.webviewPanel.webview.html = this.getWebviewContent(commits);

      // Handle webview messages
      this.webviewPanel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
          case 'showDiff':
            this.showCommitDiff(workspacePath, message.hash);
            break;
          case 'refresh':
            const updatedCommits = await this.getCommitHistory(workspacePath);
            this.webviewPanel?.webview.postMessage({ 
              command: 'updateCommits', 
              commits: updatedCommits 
            });
            break;
        }
      });
    } catch (error) {
      console.error('Error showing commit history:', error);
      vscode.window.showErrorMessage(`Failed to show commit history: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Show diff for a specific commit
   */
  private async showCommitDiff(workspacePath: string, hash: string): Promise<void> {
    try {
      const { stdout } = await execAsync(`git show ${hash}`, { cwd: workspacePath });
      
      // Show diff in output channel
      this.outputChannel.clear();
      this.outputChannel.appendLine(`Commit ${hash} diff:`);
      this.outputChannel.appendLine('='.repeat(40));
      this.outputChannel.appendLine(stdout);
      this.outputChannel.show();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show commit diff: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate HTML content for the webview
   */
  private getWebviewContent(commits: Commit[]): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Git Commit History</title>
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
            
            .commit-list {
                padding: 10px;
                overflow-y: auto;
                height: calc(100vh - 60px);
            }
            
            .commit-item {
                margin-bottom: 10px;
                padding: 10px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                cursor: pointer;
            }
            
            .commit-item:hover {
                background-color: var(--vscode-list-hoverBackground);
            }
            
            .commit-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 5px;
            }
            
            .commit-hash {
                color: var(--vscode-textLink-foreground);
                font-family: monospace;
            }
            
            .commit-date {
                color: var(--vscode-descriptionForeground);
            }
            
            .commit-author {
                margin-bottom: 5px;
                font-weight: bold;
            }
            
            .commit-message {
                margin-bottom: 8px;
            }
            
            .commit-stats {
                display: flex;
                gap: 15px;
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
            }
            
            .stat-item {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .insertion {
                color: #4CAF50;
            }
            
            .deletion {
                color: #F44336;
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
                color: var(--vscode-descriptionForeground);
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>Git Commit History</h2>
            <button id="refreshButton">Refresh</button>
        </div>
        
        <div class="commit-list" id="commitList">
            ${commits.length === 0 ? 
              `<div class="empty-state">
                <p>No commits found in this repository.</p>
                <p>Make sure you're in a Git repository with commit history.</p>
              </div>` :
              commits.map(commit => `
                <div class="commit-item" data-hash="${commit.hash}">
                    <div class="commit-header">
                        <span class="commit-hash">${commit.shortHash}</span>
                        <span class="commit-date">${commit.date}</span>
                    </div>
                    <div class="commit-author">${commit.author} &lt;${commit.email}&gt;</div>
                    <div class="commit-message">${this.escapeHtml(commit.message)}</div>
                    <div class="commit-stats">
                        <div class="stat-item">
                            <span>Files:</span>
                            <span>${commit.filesChanged || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="insertion">+${commit.insertions || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="deletion">-${commit.deletions || 0}</span>
                        </div>
                    </div>
                </div>
              `).join('')
            }
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            
            // Add click listeners to commit items
            document.querySelectorAll('.commit-item').forEach(item => {
                item.addEventListener('click', () => {
                    const hash = item.getAttribute('data-hash');
                    vscode.postMessage({
                        command: 'showDiff',
                        hash: hash
                    });
                });
            });
            
            // Refresh button
            document.getElementById('refreshButton').addEventListener('click', () => {
                vscode.postMessage({
                    command: 'refresh'
                });
            });
            
            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'updateCommits') {
                    // Update the commit list
                    const commitList = document.getElementById('commitList');
                    
                    if (message.commits.length === 0) {
                        commitList.innerHTML = \`
                            <div class="empty-state">
                                <p>No commits found in this repository.</p>
                                <p>Make sure you're in a Git repository with commit history.</p>
                            </div>
                        \`;
                        return;
                    }
                    
                    commitList.innerHTML = message.commits.map(commit => \`
                        <div class="commit-item" data-hash="\${commit.hash}">
                            <div class="commit-header">
                                <span class="commit-hash">\${commit.shortHash}</span>
                                <span class="commit-date">\${commit.date}</span>
                            </div>
                            <div class="commit-author">\${commit.author} &lt;\${commit.email}&gt;</div>
                            <div class="commit-message">\${escapeHtml(commit.message)}</div>
                            <div class="commit-stats">
                                <div class="stat-item">
                                    <span>Files:</span>
                                    <span>\${commit.filesChanged || 0}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="insertion">+\${commit.insertions || 0}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="deletion">-\${commit.deletions || 0}</span>
                                </div>
                            </div>
                        </div>
                    \`).join('');
                    
                    // Re-add click listeners
                    document.querySelectorAll('.commit-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const hash = item.getAttribute('data-hash');
                            vscode.postMessage({
                                command: 'showDiff',
                                hash: hash
                            });
                        });
                    });
                }
            });
            
            function escapeHtml(text) {
                return text
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
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