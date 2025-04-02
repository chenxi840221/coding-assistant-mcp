// src/github/github-service.ts

import * as vscode from 'vscode';
import { GitHubAuthService } from './github-auth';
import { GitHubRepoService } from './github-repo';
import { GitHubPRService } from './github-pr';
import { CommitHistoryViewer } from './commit-history-viewer';

/**
 * Main GitHub service that acts as a facade for all GitHub operations
 */
export class GitHubService {
  private static instance: GitHubService;
  private outputChannel: vscode.OutputChannel;
  private authService: GitHubAuthService;
  private repoService: GitHubRepoService;
  private prService: GitHubPRService;
  private commitHistoryViewer: CommitHistoryViewer;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('GitHub Sync');
    this.authService = new GitHubAuthService(this.outputChannel);
    this.repoService = new GitHubRepoService(this.outputChannel, this.authService);
    this.prService = new GitHubPRService(this.outputChannel, this.authService, this.repoService);
    this.commitHistoryViewer = new CommitHistoryViewer();
  }

  /**
   * Get the GitHubService singleton instance
   */
  public static getInstance(): GitHubService {
    if (!GitHubService.instance) {
      GitHubService.instance = new GitHubService();
    }
    return GitHubService.instance;
  }

  /**
   * Authenticate with GitHub
   */
  public async login(): Promise<boolean> {
    return this.authService.login();
  }

  /**
   * Get repository information
   */
  public async getRepositoryInfo() {
    return this.repoService.getRepositoryInfo();
  }

  /**
   * Clone a GitHub repository
   */
  public async cloneRepository(): Promise<boolean> {
    return this.repoService.cloneRepository();
  }

  /**
   * Set repository URL
   */
  public async setRepositoryUrl(url: string): Promise<boolean> {
    return this.repoService.setRepositoryUrl(url);
  }

  /**
   * Push changes to GitHub
   */
  public async pushChanges(): Promise<boolean> {
    return this.repoService.pushChanges();
  }

  /**
   * Create a pull request
   */
  public async createPullRequest(): Promise<boolean> {
    return this.prService.createPullRequest();
  }

  /**
   * List pull requests
   */
  public async listPullRequests(): Promise<void> {
    return this.prService.listPullRequests();
  }

  /**
   * Show commit history
   */
  public async showCommitHistory(): Promise<void> {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
      vscode.window.showErrorMessage('No workspace is currently open');
      return;
    }
    
    return this.commitHistoryViewer.showCommitHistory(workspacePath);
  }

  /**
   * Get the current repository URL
   */
  public async getCurrentRepoUrl(): Promise<string | undefined> {
    return this.repoService.getCurrentRepoUrl();
  }

  /**
   * Show logs
   */
  public showLogs(): void {
    this.outputChannel.show();
  }

  /**
   * Clear logs
   */
  public clearLogs(): void {
    this.outputChannel.clear();
    this.outputChannel.appendLine('Logs cleared');
  }
}

/**
 * Get the GitHub service singleton
 */
export function getGitHubService(): GitHubService {
  return GitHubService.getInstance();
}