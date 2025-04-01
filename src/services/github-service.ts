// src/services/github-service.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { initializeVectorStore, addToVectorStore } from '../chat/vector-store';
import { getConfig } from '../config/configuration';

const execAsync = promisify(exec);

// GitHub configuration interface
interface GitHubConfig {
  usePersonalAccessToken: boolean;
  personalAccessToken: string;
  username: string;
  password?: string;
  isAuthenticated?: boolean;
  logLevel?: 'debug' | 'info' | 'warning' | 'error';
}

/**
 * Service for GitHub operations
 */
export class GitHubService {
  private workspacePath: string | undefined;
  private outputChannel: vscode.OutputChannel;
  private config: GitHubConfig;
  private repoUrl: string | undefined;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('GitHub Sync');
    
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
    
    // Load GitHub configuration
    this.config = this.loadGitHubConfig();
    this.log('debug', 'GitHub service initialized');
    
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('claudeAssistant.github')) {
        this.config = this.loadGitHubConfig();
        this.log('debug', 'GitHub configuration updated');
      }
    });
  }
  
  /**
   * Log a message to the output channel
   */
  private log(level: 'debug' | 'info' | 'warning' | 'error', message: string): void {
    const logLevels = {
      'debug': 0,
      'info': 1,
      'warning': 2,
      'error': 3
    };
    
    // Only log if the message level is >= the configured level
    if (logLevels[level] >= logLevels[this.config.logLevel || 'info']) {
      const timestamp = new Date().toISOString();
      const prefix = level.toUpperCase().padEnd(7);
      this.outputChannel.appendLine(`[${timestamp}] ${prefix} | ${message}`);
    }
  }
  
  /**
   * Load GitHub configuration from VS Code settings
   */
  private loadGitHubConfig(): GitHubConfig {
    const config = vscode.workspace.getConfiguration('claudeAssistant.github');
    return {
      usePersonalAccessToken: config.get('usePersonalAccessToken') || false,
      personalAccessToken: config.get('personalAccessToken') || '',
      username: config.get('username') || '',
      isAuthenticated: false,
      logLevel: config.get('logLevel') || 'info'
    };
  }
  
  /**
   * Get repository information
   */
  public async getRepositoryInfo(): Promise<any> {
    if (!this.workspacePath) {
      return { isRepo: false };
    }

    let repoInfo: any = { isRepo: false };

    try {
      // Check if this is a git repository
      await execAsync('git rev-parse --is-inside-work-tree', { cwd: this.workspacePath });
      
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
        const { stdout: branchOutput } = await execAsync('git branch --show-current', { cwd: this.workspacePath });
        repoInfo.branch = branchOutput.trim() || 'No branch';
      } catch (error) {
        repoInfo.branch = 'Unknown';
      }

      // Get remote URL
      try {
        const { stdout: remoteOutput } = await execAsync('git config --get remote.origin.url', { cwd: this.workspacePath });
        repoInfo.remote = remoteOutput.trim();
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
        const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: this.workspacePath });
        repoInfo.hasChanges = statusOutput.trim().length > 0;
      } catch (error) {
        repoInfo.hasChanges = false;
      }
      
      // Add authentication info
      repoInfo.isAuthenticated = this.config.isAuthenticated || false;
      repoInfo.username = this.config.username || '';
    } catch (error) {
      // Not a git repository
      repoInfo = { isRepo: false };
    }

    return repoInfo;
  }
  
  /**
   * Authenticate with GitHub
   */
  public async login(): Promise<boolean> {
    // Maximum number of retry attempts
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let authenticated = false;
    
    this.outputChannel.show();
    this.outputChannel.appendLine('Starting GitHub authentication...');
    
    // If user is already authenticated, just return true
    if (this.config.isAuthenticated) {
      this.outputChannel.appendLine('Already authenticated with GitHub');
      vscode.window.showInformationMessage('Already authenticated with GitHub');
      return true;
    }
    
    // Authentication retry loop
    while (!authenticated && retryCount < MAX_RETRIES) {
      retryCount++;
      
      if (retryCount > 1) {
        this.outputChannel.appendLine(`Retry attempt ${retryCount}/${MAX_RETRIES}`);
        vscode.window.showInformationMessage(`Retrying GitHub authentication (${retryCount}/${MAX_RETRIES})`);
      }
      
      // Choose authentication method
      const authMethod = await vscode.window.showQuickPick(
        ['Personal Access Token (Recommended)', 'Username/Password'], 
        {
          placeHolder: 'Select GitHub authentication method',
          ignoreFocusOut: true
        }
      );
      
      if (!authMethod) {
        // User cancelled the authentication
        this.outputChannel.appendLine('Authentication cancelled by user');
        vscode.window.showInformationMessage('GitHub authentication cancelled');
        return false;
      }
      
      if (authMethod === 'Personal Access Token (Recommended)') {
        this.config.usePersonalAccessToken = true;
        
        // Get username
        let username = this.config.username;
        if (!username) {
          const inputUsername = await vscode.window.showInputBox({
            prompt: 'Enter your GitHub username',
            ignoreFocusOut: true,
            validateInput: (value) => {
              return value ? null : 'Username cannot be empty';
            }
          });
          
          if (!inputUsername) {
            continue; // Retry if no username provided
          }
          
          // Update username in memory
          username = inputUsername;
          this.config.username = inputUsername;
        }
        
        // Get token
        const token = await vscode.window.showInputBox({
          prompt: 'Enter your GitHub Personal Access Token',
          password: true, // Masks the input
          ignoreFocusOut: true,
          validateInput: (value) => {
            if (!value) return 'Token cannot be empty';
            if (value.length < 10) return 'Token seems too short';
            return null;
          }
        });
        
        if (!token) {
          continue; // Retry if no token provided
        }
        
        // Update token in memory
        this.config.personalAccessToken = token;
        
        // Try to authenticate
        try {
          // Set up basic git config for the user
          await execAsync(`git config --global user.name "${this.config.username}"`, { cwd: this.workspacePath });
          await execAsync(`git config --global user.email "${this.config.username}@users.noreply.github.com"`, { cwd: this.workspacePath });
          
          // Set up Git credentials helper to store the token
          const success = await this.setupGitCredentials();
          
          if (!success) {
            vscode.window.showErrorMessage('Failed to set up Git credentials');
            continue; // Retry on failure
          }
          
          // Test the credentials by trying to access user info
          try {
            // We'll just try to get the user's email as a test
            const { stdout } = await execAsync(`git config --get user.email`, { cwd: this.workspacePath });
            
            if (stdout.trim()) {
              authenticated = true;
              this.config.isAuthenticated = true;
              
              // Ask if user wants to save credentials
              const saveCredentials = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: 'Save credentials in VS Code settings? (Not recommended for shared workstations)'
              });
              
              if (saveCredentials === 'Yes') {
                await vscode.workspace.getConfiguration('claudeAssistant.github').update(
                  'usePersonalAccessToken', 
                  true, 
                  vscode.ConfigurationTarget.Global
                );
                
                await vscode.workspace.getConfiguration('claudeAssistant.github').update(
                  'personalAccessToken', 
                  token, 
                  vscode.ConfigurationTarget.Global
                );
                
                await vscode.workspace.getConfiguration('claudeAssistant.github').update(
                  'username', 
                  username, 
                  vscode.ConfigurationTarget.Global
                );
              }
              
              this.outputChannel.appendLine('Successfully authenticated with GitHub using personal access token');
              vscode.window.showInformationMessage('Successfully authenticated with GitHub');
            }
          } catch (testError) {
            this.outputChannel.appendLine(`Authentication test failed: ${testError instanceof Error ? testError.message : String(testError)}`);
            vscode.window.showErrorMessage('Authentication test failed. Please check your credentials.');
          }
        } catch (error) {
          this.outputChannel.appendLine(`Authentication error: ${error instanceof Error ? error.message : String(error)}`);
          vscode.window.showErrorMessage(`GitHub authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        // Username/Password authentication (with warning)
        this.config.usePersonalAccessToken = false;
        
        // Show warning about password authentication
        const warningResponse = await vscode.window.showWarningMessage(
          'GitHub no longer fully supports password authentication. Using a personal access token is recommended.',
          'Continue Anyway',
          'Switch to Token',
          'Learn More'
        );
        
        if (warningResponse === 'Learn More') {
          vscode.env.openExternal(vscode.Uri.parse('https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token'));
          continue; // Restart the process
        } else if (warningResponse === 'Switch to Token') {
          continue; // Restart the process
        } else if (warningResponse !== 'Continue Anyway') {
          // User cancelled
          return false;
        }
        
        // Get username
        if (!this.config.username) {
          const inputUsername = await vscode.window.showInputBox({
            prompt: 'Enter your GitHub username',
            ignoreFocusOut: true,
            validateInput: (value) => {
              return value ? null : 'Username cannot be empty';
            }
          });
          
          if (!inputUsername) {
            continue; // Retry if no username provided
          }
          
          // Update username in memory
          this.config.username = inputUsername;
        }
        
        // Get password
        const password = await vscode.window.showInputBox({
          prompt: 'Enter your GitHub password',
          password: true, // Masks the input
          ignoreFocusOut: true,
          validateInput: (value) => {
            return value ? null : 'Password cannot be empty';
          }
        });
        
        if (!password) {
          continue; // Retry if no password provided
        }
        
        // Store password temporarily in memory
        this.config.password = password;
        
        // Try to authenticate
        try {
          // Set up basic git config for the user
          await execAsync(`git config --global user.name "${this.config.username}"`, { cwd: this.workspacePath });
          await execAsync(`git config --global user.email "${this.config.username}@users.noreply.github.com"`, { cwd: this.workspacePath });
          
          // Set up Git credentials
          const success = await this.setupGitCredentials();
          
          if (!success) {
            vscode.window.showErrorMessage('Failed to set up Git credentials');
            continue; // Retry on failure
          }
          
          authenticated = true;
          this.config.isAuthenticated = true;
          
          // Only save username, never save password
          const saveUsername = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Save username in VS Code settings?'
          });
          
          if (saveUsername === 'Yes') {
            await vscode.workspace.getConfiguration('claudeAssistant.github').update(
              'username', 
              this.config.username, 
              vscode.ConfigurationTarget.Global
            );
            
            await vscode.workspace.getConfiguration('claudeAssistant.github').update(
              'usePersonalAccessToken', 
              false, 
              vscode.ConfigurationTarget.Global
            );
          }
          
          this.outputChannel.appendLine('Successfully authenticated with GitHub using username/password');
          vscode.window.showInformationMessage('Successfully authenticated with GitHub');
        } catch (error) {
          this.outputChannel.appendLine(`Authentication error: ${error instanceof Error ? error.message : String(error)}`);
          vscode.window.showErrorMessage(`GitHub authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    
    if (!authenticated && retryCount >= MAX_RETRIES) {
      this.outputChannel.appendLine(`Authentication failed after ${MAX_RETRIES} attempts`);
      vscode.window.showErrorMessage(`GitHub authentication failed after ${MAX_RETRIES} attempts`);
    }
    
    return authenticated;
  }

  /**
   * Set up Git credentials if configured
   */
  private async setupGitCredentials(): Promise<boolean> {
    if (this.config.usePersonalAccessToken && this.config.personalAccessToken && this.config.username) {
      try {
        // Set Git credentials using the personal access token
        const username = this.config.username;
        const token = this.config.personalAccessToken;
        
        // Use credential helper to store the credentials
        await execAsync(`git config --global credential.helper store`, { cwd: this.workspacePath });
        
        // Create credentials string in the proper format
        const credentialInput = `protocol=https\nhost=github.com\nusername=${username}\npassword=${token}\n`;
        
        // Use a temporary file to avoid exposing token in command line
        const tempFile = path.join(os.tmpdir(), `git-credentials-${Date.now()}`);
        fs.writeFileSync(tempFile, credentialInput);
        
        // Execute git credential store
        await execAsync(`git credential approve < "${tempFile}"`, { cwd: this.workspacePath });
        
        // Clean up temporary file
        fs.unlinkSync(tempFile);
        
        // Also configure user info
        await execAsync(`git config --global user.name "${username}"`, { cwd: this.workspacePath });
        await execAsync(`git config --global user.email "${username}@users.noreply.github.com"`, { cwd: this.workspacePath });
        
        this.outputChannel.appendLine('Git credentials configured successfully');
        return true;
      } catch (error) {
        this.outputChannel.appendLine(`Error setting up Git credentials: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    } else if (this.config.password && this.config.username) {
      // Use password authentication (not recommended but supported for backward compatibility)
      try {
        const username = this.config.username;
        const password = this.config.password;
        
        // Use credential helper to store the credentials
        await execAsync(`git config --global credential.helper store`, { cwd: this.workspacePath });
        
        // Create credentials string in the proper format
        const credentialInput = `protocol=https\nhost=github.com\nusername=${username}\npassword=${password}\n`;
        
        // Use a temporary file to avoid exposing password in command line
        const tempFile = path.join(os.tmpdir(), `git-credentials-${Date.now()}`);
        fs.writeFileSync(tempFile, credentialInput);
        
        // Execute git credential store
        await execAsync(`git credential approve < "${tempFile}"`, { cwd: this.workspacePath });
        
        // Clean up temporary file
        fs.unlinkSync(tempFile);
        
        this.outputChannel.appendLine('Git credentials configured successfully');
        return true;
      } catch (error) {
        this.outputChannel.appendLine(`Error setting up Git credentials: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    }
    
    return true; // No credentials to set up, continue
  }

  /**
   * Get the current repository URL
   */
  public async getCurrentRepoUrl(): Promise<string | undefined> {
    if (!this.workspacePath) {
      return undefined;
    }
    
    try {
      // Check if this is a git repository
      await execAsync('git rev-parse --is-inside-work-tree', { cwd: this.workspacePath });
      
      // Get remote URL
      const { stdout } = await execAsync('git config --get remote.origin.url', { 
        cwd: this.workspacePath 
      });
      
      return stdout.trim();
    } catch (error) {
      // Not a git repository or no remote
      return undefined;
    }
  }
  
  /**
   * Set a new repository URL for the current workspace
   */
  public async setRepositoryUrl(newUrl: string): Promise<boolean> {
    if (!this.workspacePath) {
      vscode.window.showErrorMessage('No workspace is currently open');
      return false;
    }
    
    if (!await this.isGitInstalled()) {
      return false;
    }
    
    try {
      // Check if this is a git repository
      const isRepo = await this.isGitRepository();
      
      if (!isRepo) {
        // Initialize git repository if it doesn't exist
        await execAsync('git init', { cwd: this.workspacePath });
        this.outputChannel.appendLine('Initialized new Git repository');
      }
      
      // Set the remote URL
      const remoteExists = await this.remoteExists('origin');
      
      if (remoteExists) {
        // Update existing remote
        await execAsync(`git remote set-url origin "${newUrl}"`, { cwd: this.workspacePath });
        this.outputChannel.appendLine(`Updated remote URL to: ${newUrl}`);
      } else {
        // Add new remote
        await execAsync(`git remote add origin "${newUrl}"`, { cwd: this.workspacePath });
        this.outputChannel.appendLine(`Added remote URL: ${newUrl}`);
      }
      
      // Store the new URL
      this.repoUrl = newUrl;
      
      vscode.window.showInformationMessage(`Repository URL set to: ${newUrl}`);
      return true;
    } catch (error) {
      this.outputChannel.appendLine(`Error setting repository URL: ${error instanceof Error ? error.message : String(error)}`);
      vscode.window.showErrorMessage(`Failed to set repository URL: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  /**
   * Check if a remote exists
   */
  private async remoteExists(remoteName: string): Promise<boolean> {
    try {
      await execAsync(`git remote get-url ${remoteName}`, { cwd: this.workspacePath });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if git is installed
   */
  private async isGitInstalled(): Promise<boolean> {
    try {
      await execAsync('git --version');
      return true;
    } catch (error) {
      this.outputChannel.appendLine('Git is not installed or not in PATH');
      vscode.window.showErrorMessage('Git is not installed or not in PATH. Please install Git to use the GitHub sync features.');
      return false;
    }
  }

  /**
   * Check if the current directory is a git repository
   */
  private async isGitRepository(): Promise<boolean> {
    if (!this.workspacePath) {
      return false;
    }

    try {
      await execAsync('git rev-parse --is-inside-work-tree', { cwd: this.workspacePath });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clone a repository from GitHub
   */
  public async cloneRepository(): Promise<boolean> {
    if (!await this.isGitInstalled()) {
      return false;
    }
    
    // Authenticate with GitHub if private repositories are needed
    const needsAuth = await vscode.window.showQuickPick(['Yes', 'No'], {
      placeHolder: 'Does the repository require authentication? (Private repository)'
    });
    
    if (needsAuth === 'Yes') {
      const authenticated = await this.login();
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
        this.outputChannel.appendLine(`Cloning ${repoUrl} to ${clonePath}...`);

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

        this.outputChannel.appendLine('Repository cloned successfully!');
        
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
        this.outputChannel.appendLine(`Error cloning repository: ${error instanceof Error ? error.message : String(error)}`);
        vscode.window.showErrorMessage(`Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    });
  }

  /**
   * Push changes to GitHub
   */
  public async pushChanges(): Promise<boolean> {
    if (!await this.isGitInstalled()) {
      return false;
    }

    if (!await this.isGitRepository()) {
      vscode.window.showErrorMessage('The current workspace is not a Git repository');
      return false;
    }
    
    // Make sure user is authenticated
    if (!this.config.isAuthenticated) {
      vscode.window.showInformationMessage('Authentication required to push changes');
      const authenticated = await this.login();
      if (!authenticated) {
        vscode.window.showErrorMessage('GitHub authentication failed. Cannot push changes.');
        return false;
      }
    }
    
    // Set up git credentials if configured
    if (!await this.setupGitCredentials()) {
      vscode.window.showErrorMessage('Failed to set up Git credentials');
      return false;
    }

    // Show progress
    return await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Pushing changes to GitHub',
      cancellable: true
    }, async (progress, token) => {
      try {
        this.outputChannel.show();
        this.outputChannel.appendLine('Pushing changes to GitHub...');

        // Check for changes to stage
        const { stdout: statusOutput } = await execAsync('git status --porcelain', { 
          cwd: this.workspacePath 
        });

        if (statusOutput.trim().length > 0) {
          // Stage all changes automatically
          this.outputChannel.appendLine('Staging all changes...');
          await execAsync('git add .', { cwd: this.workspacePath });

          // Generate automatic commit message with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const commitMessage = `Automatic update - ${timestamp}`;
          
          // Commit changes
          this.outputChannel.appendLine(`Committing with message: ${commitMessage}`);
          await execAsync(`git commit -m "${commitMessage}"`, { cwd: this.workspacePath });
          
          vscode.window.showInformationMessage(`Changes committed with message: ${commitMessage}`);
        } else {
          this.outputChannel.appendLine('No changes to commit');
        }

        // Get current branch
        const { stdout: branchOutput } = await execAsync('git branch --show-current', { 
          cwd: this.workspacePath 
        });
        const currentBranch = branchOutput.trim();

        // Push to remote
        this.outputChannel.appendLine(`Pushing to branch: ${currentBranch}`);
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

        this.outputChannel.appendLine('Changes pushed successfully!');
        vscode.window.showInformationMessage('Changes pushed to GitHub successfully!');
        
        // Automatically analyze repository after pushing changes
        progress.report({ message: 'Analyzing code for knowledge base...' });
        await this.analyzeAndStoreRepository();
        
        return true;
      } catch (error) {
        this.outputChannel.appendLine(`Error pushing changes: ${error instanceof Error ? error.message : String(error)}`);
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
    
    if (!await this.isGitRepository()) {
      vscode.window.showErrorMessage('The current workspace is not a Git repository');
      return false;
    }
    
    // Make sure user is authenticated
    if (!this.config.isAuthenticated) {
      this.log('info', 'Authentication required to create pull request');
      vscode.window.showInformationMessage('Authentication required to create pull request');
      const authenticated = await this.login();
      if (!authenticated) {
        vscode.window.showErrorMessage('GitHub authentication failed. Cannot create pull request.');
        return false;
      }
    }
    
    // Extract repository info from remote URL
    const repoInfo = await this.extractRepoInfoFromUrl();
    if (!repoInfo) {
      vscode.window.showErrorMessage('Could not determine GitHub repository owner and name from remote URL');
      return false;
    }
    
    try {
      // Get current branch if not specified
      let headBranch = options.headBranch;
      if (!headBranch) {
        const { stdout } = await execAsync('git branch --show-current', { cwd: this.workspacePath });
        headBranch = stdout.trim();
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
      const token = this.config.personalAccessToken;
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
   * Extract owner and repo name from the remote URL
   */
  private async extractRepoInfoFromUrl(): Promise<{ owner: string; repo: string } | null> {
    const remoteUrl = await this.getCurrentRepoUrl();
    if (!remoteUrl) {
      this.log('error', 'No remote URL configured');
      return null;
    }
    
    this.log('debug', `Extracting repo info from URL: ${remoteUrl}`);
    
    // Handle different formats of GitHub URLs
    let match;
    
    // HTTPS format: https://github.com/owner/repo.git
    match = remoteUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)(\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
    
    // SSH format: git@github.com:owner/repo.git
    match = remoteUrl.match(/git@github\.com:([^\/]+)\/([^\/\.]+)(\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
    
    this.log('error', `Could not parse GitHub repository info from URL: ${remoteUrl}`);
    return null;
  }
  
  /**
   * Show the GitHub logs
   */
  public showLogs(): void {
    this.outputChannel.show();
  }
  
  /**
   * Clear the GitHub logs
   */
  public clearLogs(): void {
    this.outputChannel.clear();
    this.log('info', 'Logs cleared');
  }