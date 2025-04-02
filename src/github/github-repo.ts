// src/github/github-repo.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { GitHubAuthService } from './github-auth';
import { 
  execAsync, 
  isGitInstalled, 
  isGitRepository, 
  getCurrentRepoUrl, 
  remoteExists, 
  getCurrentBranch, 
  hasUncommittedChanges,
  extractRepoInfoFromUrl
} from './git-utils';
import { initializeVectorStore, addToVectorStore } from '../chat/vector-store';

/**
 * Repository information interface
 */
export interface RepositoryInfo {
  isRepo: boolean;
  name?: string;
  branch?: string;
  remote?: string;
  lastCommit?: string;
  hasChanges?: boolean;
  isAuthenticated?: boolean;
  username?: string;
}

/**
 * Service for repository operations
 */
export class GitHubRepoService {
  private workspacePath: string | undefined;
  private outputChannel: vscode.OutputChannel;
  private authService: GitHubAuthService;
  private repoUrl: string | undefined;

  constructor(outputChannel: vscode.OutputChannel, authService: GitHubAuthService) {
    this.outputChannel = outputChannel;
    this.authService = authService;
    
    // Get workspace path if available
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      this.workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      
      // Try to get current repository URL
      this.getCurrentRepoUrl().then(url => {
        this.repoUrl = url;
        this.log('debug', `Detected repository URL: ${url || 'none'}`);
      }).catch(() => {
        // Ignore error
      });
    }
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
   * Get current repository URL
   */
  public async getCurrentRepoUrl(): Promise<string | undefined> {
    return getCurrentRepoUrl(this.workspacePath);
  }

  /**
   * Get repository information
   */
  public async getRepositoryInfo(): Promise<RepositoryInfo> {
    if (!this.workspacePath) {
      return { isRepo: false };
    }

    let repoInfo: RepositoryInfo = { isRepo: false };

    try {
      // Check if this is a git repository
      const isRepo = await isGitRepository(this.workspacePath);
      
      if (!isRepo) {
        return { isRepo: false };
      }
      
      repoInfo.isRepo = true;

      // Get repository name
      try {
        const { stdout: repoNameOutput } = await execAsync('git rev-parse --show-toplevel', { cwd: this.workspacePath });
        repoInfo.name = path.basename(repoNameOutput.trim());
      } catch (error) {
        repoInfo.name = 'Unknown';
      }

      // Get current branch
      try {
        const branch = await getCurrentBranch(this.workspacePath);
        repoInfo.branch = branch || 'No branch';
      } catch (error) {
        repoInfo.branch = 'Unknown';
      }

      // Get remote URL
      try {
        const remote = await this.getCurrentRepoUrl();
        repoInfo.remote = remote || 'No remote configured';
        this.repoUrl = repoInfo.remote;
      } catch (error) {
        repoInfo.remote = 'No remote configured';
      }

      // Get last commit
      try {
        const { stdout: commitOutput } = await execAsync('git log -1 --pretty=format:"%h - %s (%cr)"', { cwd: this.workspacePath });
        repoInfo.lastCommit = commitOutput || 'No commits';
      } catch (error) {
        repoInfo.lastCommit = 'No commits yet';
      }

      // Check for changes
      try {
        repoInfo.hasChanges = await hasUncommittedChanges(this.workspacePath);
      } catch (error) {
        repoInfo.hasChanges = false;
      }
      
      // Add authentication info
      const config = this.authService.getConfig();
      repoInfo.isAuthenticated = config.isAuthenticated || false;
      repoInfo.username = config.username || '';
    } catch (error) {
      // Not a git repository
      repoInfo = { isRepo: false };
    }

    return repoInfo;
  }

  /**
   * Set a new repository URL for the current workspace
   */
  public async setRepositoryUrl(newUrl: string): Promise<boolean> {
    if (!this.workspacePath) {
      vscode.window.showErrorMessage('No workspace is currently open');
      return false;
    }
    
    if (!await isGitInstalled()) {
      vscode.window.showErrorMessage('Git is not installed or not in PATH');
      return false;
    }
    
    try {
      // Check if this is a git repository
      const isRepo = await isGitRepository(this.workspacePath);
      
      if (!isRepo) {
        // Initialize git repository if it doesn't exist
        await execAsync('git init', { cwd: this.workspacePath });
        this.log('info', 'Initialized new Git repository');
      }
      
      // Set the remote URL
      const remoteExistsFlag = await remoteExists('origin', this.workspacePath);
      
      if (remoteExistsFlag) {
        // Update existing remote
        await execAsync(`git remote set-url origin "${newUrl}"`, { cwd: this.workspacePath });
        this.log('info', `Updated remote URL to: ${newUrl}`);
      } else {
        // Add new remote
        await execAsync(`git remote add origin "${newUrl}"`, { cwd: this.workspacePath });
        this.log('info', `Added remote URL: ${newUrl}`);
      }
      
      // Store the new URL
      this.repoUrl = newUrl;
      
      vscode.window.showInformationMessage(`Repository URL set to: ${newUrl}`);
      return true;
    } catch (error) {
      this.log('error', `Error setting repository URL: ${error instanceof Error ? error.message : String(error)}`);
      vscode.window.showErrorMessage(`Failed to set repository URL: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Clone a repository from GitHub
   */
  public async cloneRepository(): Promise<boolean> {
    if (!await isGitInstalled()) {
      vscode.window.showErrorMessage('Git is not installed or not in PATH');
      return false;
    }
    
    // Authenticate with GitHub if private repositories are needed
    const needsAuth = await vscode.window.showQuickPick(['Yes', 'No'], {
      placeHolder: 'Does the repository require authentication? (Private repository)'
    });
    
    if (needsAuth === 'Yes') {
      const authenticated = await this.authService.login(this.workspacePath);
      if (!authenticated) {
        vscode.window.showErrorMessage('GitHub authentication failed. Cannot clone private repository.');
        return false;
      }
    }

    // Ask for repository URL
    const repoUrl = await vscode.window.showInputBox({
      prompt: 'Enter GitHub repository URL',
      placeHolder: 'https://github.com/username/repository.git',
      value: this.repoUrl
    });

    if (!repoUrl) {
      return false;
    }

    // Ask for target directory
    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Clone Location'
    });

    if (!folderUri || folderUri.length === 0) {
      return false;
    }

    const targetDir = folderUri[0].fsPath;

    // Get repository name from URL
    const repoName = path.basename(repoUrl, '.git');
    const clonePath = path.join(targetDir, repoName);

    // Show progress
    return await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Cloning ${repoUrl}`,
      cancellable: true
    }, async (progress, token) => {
      try {
        this.outputChannel.show();
        this.log('info', `Cloning ${repoUrl} to ${clonePath}...`);

        // Clone the repository
        const cloneProcess = spawn('git', ['clone', repoUrl], { cwd: targetDir });
        
        // Handle output
        cloneProcess.stdout.on('data', (data) => {
          this.outputChannel.append(data.toString());
        });
        
        cloneProcess.stderr.on('data', (data) => {
          this.outputChannel.append(data.toString());
        });

        // Wait for process to complete
        await new Promise<void>((resolve, reject) => {
          cloneProcess.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Git clone process exited with code ${code}`));
            }
          });
          
          token.onCancellationRequested(() => {
            cloneProcess.kill();
            reject(new Error('Clone operation was cancelled'));
          });
        });

        this.log('info', 'Repository cloned successfully!');
        
        // Open the cloned repository
        const uri = vscode.Uri.file(clonePath);
        await vscode.commands.executeCommand('vscode.openFolder', uri);
        
        // Update workspace path to the new repository
        this.workspacePath = clonePath;
        this.repoUrl = repoUrl;
        
        // Automatically analyze repository after cloning
        progress.report({ message: 'Analyzing repository for code knowledge base...' });
        
        // Slight delay to allow VS Code to fully load the new workspace
        setTimeout(async () => {
          try {
            await this.analyzeAndStoreRepository();
            vscode.window.showInformationMessage('Repository analyzed and added to knowledge base');
          } catch (error) {
            console.error('Error during automatic analysis:', error);
          }
        }, 2000);
        
        return true;
      } catch (error) {
        this.log('error', `Error cloning repository: ${error instanceof Error ? error.message : String(error)}`);
        vscode.window.showErrorMessage(`Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    });
  }

  /**
   * Push changes to GitHub
   */
  public async pushChanges(): Promise<boolean> {
    if (!await isGitInstalled()) {
      vscode.window.showErrorMessage('Git is not installed or not in PATH');
      return false;
    }

    if (!await isGitRepository(this.workspacePath)) {
      vscode.window.showErrorMessage('The current workspace is not a Git repository');
      return false;
    }
    
    // Make sure user is authenticated
    if (!this.authService.isAuthenticated()) {
      vscode.window.showInformationMessage('Authentication required to push changes');
      const authenticated = await this.authService.login(this.workspacePath);
      if (!authenticated) {
        vscode.window.showErrorMessage('GitHub authentication failed. Cannot push changes.');
        return false;
      }
    }

    // Show progress
    return await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Pushing changes to GitHub',
      cancellable: true
    }, async (progress, token) => {
      try {
        this.outputChannel.show();
        this.log('info', 'Pushing changes to GitHub...');

        // Check for changes to stage
        const hasChanges = await hasUncommittedChanges(this.workspacePath);

        if (hasChanges) {
          // Stage all changes automatically
          this.log('info', 'Staging all changes...');
          await execAsync('git add .', { cwd: this.workspacePath });

          // Generate automatic commit message with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const commitMessage = `Automatic update - ${timestamp}`;
          
          // Commit changes
          this.log('info', `Committing with message: ${commitMessage}`);
          await execAsync(`git commit -m "${commitMessage}"`, { cwd: this.workspacePath });
          
          vscode.window.showInformationMessage(`Changes committed with message: ${commitMessage}`);
        } else {
          this.log('info', 'No changes to commit');
        }

        // Get current branch
        const currentBranch = await getCurrentBranch(this.workspacePath);
        if (!currentBranch) {
          throw new Error('Could not determine current branch');
        }

        // Push to remote
        this.log('info', `Pushing to branch: ${currentBranch}`);
        const pushProcess = spawn('git', ['push', 'origin', currentBranch], { 
          cwd: this.workspacePath 
        });

        // Handle output
        pushProcess.stdout.on('data', (data) => {
          this.outputChannel.append(data.toString());
        });
        
        pushProcess.stderr.on('data', (data) => {
          this.outputChannel.append(data.toString());
        });

        // Wait for process to complete
        await new Promise<void>((resolve, reject) => {
          pushProcess.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Git push process exited with code ${code}`));
            }
          });
          
          token.onCancellationRequested(() => {
            pushProcess.kill();
            reject(new Error('Push operation was cancelled'));
          });
        });

        this.log('info', 'Changes pushed successfully!');
        vscode.window.showInformationMessage('Changes pushed to GitHub successfully!');
        
        // Automatically analyze repository after pushing changes
        progress.report({ message: 'Analyzing code for knowledge base...' });
        await this.analyzeAndStoreRepository();
        
        return true;
      } catch (error) {
        this.log('error', `Error pushing changes: ${error instanceof Error ? error.message : String(error)}`);
        vscode.window.showErrorMessage(`Failed to push changes: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    });
  }

  /**
   * Create a pull request on GitHub
   */
  public async createPullRequest(options: {
    title: string;
    body?: string;
    baseBranch?: string;
    headBranch?: string;
  }): Promise<boolean> {
    if (!this.workspacePath) {
      vscode.window.showErrorMessage('No workspace is currently open');
      return false;
    }
    
    if (!await isGitRepository(this.workspacePath)) {
      vscode.window.showErrorMessage('The current workspace is not a Git repository');
      return false;
    }
    
    // Make sure user is authenticated
    if (!this.authService.isAuthenticated()) {
      this.log('info', 'Authentication required to create pull request');
      vscode.window.showInformationMessage('Authentication required to create pull request');
      const authenticated = await this.authService.login(this.workspacePath);
      if (!authenticated) {
        vscode.window.showErrorMessage('GitHub authentication failed. Cannot create pull request.');
        return false;
      }
    }
    
    // Get current repository URL
    const repoUrl = await this.getCurrentRepoUrl();
    if (!repoUrl) {
      vscode.window.showErrorMessage('Could not determine repository URL');
      return false;
    }
    
    // Extract repository info from remote URL
    const repoInfo = extractRepoInfoFromUrl(repoUrl);
    if (!repoInfo) {
      vscode.window.showErrorMessage('Could not determine GitHub repository owner and name from remote URL');
      return false;
    }
    
    try {
      // Get current branch if not specified
      let headBranch = options.headBranch;
      if (!headBranch) {
        headBranch = await getCurrentBranch(this.workspacePath);
        if (!headBranch) {
          throw new Error('Could not determine current branch');
        }
        this.log('debug', `Using current branch for PR: ${headBranch}`);
      }
      
      // Set default base branch if not specified
      const baseBranch = options.baseBranch || 'main';
      
      this.log('info', `Creating pull request from ${headBranch} to ${baseBranch}`);
      
      // Make sure local changes are pushed
      this.log('info', 'Checking for unpushed changes');
      const { stdout: unpushedOutput } = await execAsync(
        `git log origin/${headBranch}..${headBranch} --oneline`,
        { cwd: this.workspacePath }
      ).catch(() => ({ stdout: 'cannot determine' }));
      
      if (unpushedOutput.trim() !== '') {
        const pushFirst = await vscode.window.showWarningMessage(
          'There are unpushed changes in your branch. Push changes first?',
          'Yes',
          'No'
        );
        
        if (pushFirst === 'Yes') {
          const pushed = await this.pushChanges();
          if (!pushed) {
            return false;
          }
        } else if (pushFirst !== 'No') {
          // User dismissed the dialog
          return false;
        }
      }
      
      // Create the pull request using GitHub REST API
      this.log('info', 'Sending pull request to GitHub API');
      
      const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/pulls`;
      const prData = {
        title: options.title,
        body: options.body || '',
        head: headBranch,
        base: baseBranch
      };
      
      // Get auth token
      const config = this.authService.getConfig();
      const token = config.personalAccessToken;
      if (!token) {
        vscode.window.showErrorMessage('GitHub personal access token not found');
        return false;
      }
      
      // Show progress indicator
      return await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Creating pull request',
        cancellable: false
      }, async (progress) => {
        try {
          progress.report({ message: 'Connecting to GitHub...' });
          
          // Use axios to make the API request
          const axios = require('axios');
          const response = await axios.post(apiUrl, prData, {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'Authorization': `token ${token}`,
              'User-Agent': 'Claude-Coding-Assistant'
            }
          });
          
          if (response.status === 201) {
            const prUrl = response.data.html_url;
            this.log('info', `Pull request created successfully: ${prUrl}`);
            
            // Show success message with link to the PR
            const openPr = await vscode.window.showInformationMessage(
              `Pull request created successfully!`,
              'Open in Browser'
            );
            
            if (openPr === 'Open in Browser') {
              vscode.env.openExternal(vscode.Uri.parse(prUrl));
            }
            
            return true;
          } else {
            throw new Error(`Unexpected status code: ${response.status}`);
          }
        } catch (error: any) {
          // Handle API errors
          if (error.response) {
            const errorMessage = error.response.data.message || 'Unknown API error';
            const errorDetails = error.response.data.errors ? 
              error.response.data.errors.map((e: any) => e.message).join(', ') : '';
            
            this.log('error', `GitHub API error: ${errorMessage} - ${errorDetails}`);
            vscode.window.showErrorMessage(
              `Failed to create pull request: ${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`
            );
          } else {
            this.log('error', `Error creating pull request: ${error.message || error}`);
            vscode.window.showErrorMessage(`Failed to create pull request: ${error.message || 'Unknown error'}`);
          }
          return false;
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('error', `Error creating pull request: ${errorMessage}`);
      vscode.window.showErrorMessage(`Failed to create pull request: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Analyze repository and store in vector database
   */
  public async analyzeAndStoreRepository(): Promise<void> {
    if (!this.workspacePath) {
      return;
    }

    try {
      // Initialize vector store if needed
      await initializeVectorStore();
      
      // Scan workspace and add files to vector store
      // This is a simplified implementation, you would want more robust file handling
      const fs = require('fs');
      const path = require('path');
      
      // Get all .ts, .js, .json files in the workspace
      const { stdout } = await execAsync(
        'git ls-files "*.ts" "*.js" "*.json" "*.md"', 
        { cwd: this.workspacePath }
      );
      
      const files = stdout.split('\n').filter(Boolean);
      
      for (const file of files) {
        try {
          const filePath = path.join(this.workspacePath, file);
          const content = fs.readFileSync(filePath, 'utf8');
          
          await addToVectorStore({
            path: filePath,
            content: content,
            type: path.extname(file).substring(1)
          });
        } catch (fileError) {
          console.error(`Error adding file to vector store: ${file}`, fileError);
        }
      }
      
      this.log('info', `Repository analysis complete: ${files.length} files processed`);
    } catch (error) {
      console.error('Error analyzing repository:', error);
      throw error;
    }
  }
}