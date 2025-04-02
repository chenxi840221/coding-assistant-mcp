// src/github/github-auth.ts

import * as vscode from 'vscode';
import { storeGitCredentials } from './git-utils';

// GitHub configuration interface
export interface GitHubConfig {
  usePersonalAccessToken: boolean;
  personalAccessToken: string;
  username: string;
  password?: string;
  isAuthenticated?: boolean;
  logLevel?: 'debug' | 'info' | 'warning' | 'error';
}

/**
 * Service to handle GitHub authentication
 */
export class GitHubAuthService {
  private config: GitHubConfig;
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.config = this.loadGitHubConfig();
    
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('claudeAssistant.github')) {
        this.config = this.loadGitHubConfig();
        this.log('debug', 'GitHub configuration updated');
      }
    });
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
   * Get the current GitHub configuration
   */
  public getConfig(): GitHubConfig {
    return { ...this.config };
  }

  /**
   * Check if the user is authenticated
   */
  public isAuthenticated(): boolean {
    return !!this.config.isAuthenticated;
  }

  /**
   * Authenticate with GitHub
   */
  public async login(workspacePath?: string): Promise<boolean> {
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
        authenticated = await this.authenticateWithToken(workspacePath);
      } else {
        authenticated = await this.authenticateWithPassword(workspacePath);
      }
    }
    
    if (!authenticated && retryCount >= MAX_RETRIES) {
      this.outputChannel.appendLine(`Authentication failed after ${MAX_RETRIES} attempts`);
      vscode.window.showErrorMessage(`GitHub authentication failed after ${MAX_RETRIES} attempts`);
    }
    
    return authenticated;
  }

  /**
   * Authenticate with personal access token
   */
  private async authenticateWithToken(workspacePath?: string): Promise<boolean> {
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
        return false; // User cancelled
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
      return false; // User cancelled
    }
    
    // Update token in memory
    this.config.personalAccessToken = token;
    
    try {
      // Set up Git credentials
      const success = await storeGitCredentials(username, token, workspacePath);
      
      if (!success) {
        vscode.window.showErrorMessage('Failed to set up Git credentials');
        return false;
      }
      
      // Test the credentials by trying to access user info
      try {
        // We'll just try to get the user's email as a test
        const { execAsync } = await import('./git-utils');
        const { stdout } = await execAsync(`git config --get user.email`, { cwd: workspacePath });
        
        if (stdout.trim()) {
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
          return true;
        }
      } catch (testError) {
        this.outputChannel.appendLine(`Authentication test failed: ${testError instanceof Error ? testError.message : String(testError)}`);
        vscode.window.showErrorMessage('Authentication test failed. Please check your credentials.');
      }
    } catch (error) {
      this.outputChannel.appendLine(`Authentication error: ${error instanceof Error ? error.message : String(error)}`);
      vscode.window.showErrorMessage(`GitHub authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return false;
  }

  /**
   * Authenticate with username and password
   */
  private async authenticateWithPassword(workspacePath?: string): Promise<boolean> {
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
      return false; // Restart the process
    } else if (warningResponse === 'Switch to Token') {
      return await this.authenticateWithToken(workspacePath);
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
        return false; // User cancelled
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
      return false; // User cancelled
    }
    
    // Store password temporarily in memory
    this.config.password = password;
    
    try {
      // Set up Git credentials
      // Import execAsync to avoid circular dependencies
      const { execAsync } = await import('./git-utils');
      
      // Set up basic git config for the user
      await execAsync(`git config --global user.name "${this.config.username}"`, { cwd: workspacePath });
      await execAsync(`git config --global user.email "${this.config.username}@users.noreply.github.com"`, { cwd: workspacePath });
      
      // Use credential helper to store the credentials
      await execAsync(`git config --global credential.helper store`, { cwd: workspacePath });
      
      // Import fs and path
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      // Create credentials string in the proper format
      const credentialInput = `protocol=https\nhost=github.com\nusername=${this.config.username}\npassword=${password}\n`;
      
      // Use a temporary file to avoid exposing password in command line
      const tempFile = path.join(os.tmpdir(), `git-credentials-${Date.now()}`);
      fs.writeFileSync(tempFile, credentialInput);
      
      // Execute git credential store
      await execAsync(`git credential approve < "${tempFile}"`, { cwd: workspacePath });
      
      // Clean up temporary file
      fs.unlinkSync(tempFile);
      
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
      return true;
    } catch (error) {
      this.outputChannel.appendLine(`Authentication error: ${error instanceof Error ? error.message : String(error)}`);
      vscode.window.showErrorMessage(`GitHub authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
}