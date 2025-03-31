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
}

/**
 * Service for GitHub operations
 */
export class GitHubService {
  private workspacePath: string | undefined;
  private outputChannel: vscode.OutputChannel;
  private config: GitHubConfig;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('GitHub Sync');
    
    // Get workspace path if available
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      this.workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    
    // Load GitHub configuration
    this.config = this.loadGitHubConfig();
    
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('claudeAssistant.github')) {
        this.config = this.loadGitHubConfig();
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
      username: config.get('username') || ''
    };
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

    // Ask for repository URL
    const repoUrl = await vscode.window.showInputBox({
      prompt: 'Enter GitHub repository URL',
      placeHolder: 'https://github.com/username/repository.git'
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
        
        // Analyze repository after cloning
        this.analyzeAndStoreRepository();
        
        return true;
      } catch (error) {
        this.outputChannel.appendLine(`Error cloning repository: ${error instanceof Error ? error.message : String(error)}`);
        vscode.window.showErrorMessage(`Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    });
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
        
        // Create credentials string
        const credentialInput = `https://${username}:${token}@github.com`;
        
        // Use a temporary file to avoid exposing token in command line
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
          // Ask for commit message
          const commitMessage = await vscode.window.showInputBox({
            prompt: 'Enter commit message',
            placeHolder: 'Add new feature'
          });

          if (!commitMessage) {
            this.outputChannel.appendLine('Push cancelled: No commit message provided');
            return false;
          }

          // Stage all changes
          this.outputChannel.appendLine('Staging changes...');
          await execAsync('git add .', { cwd: this.workspacePath });

          // Commit changes
          this.outputChannel.appendLine(`Committing with message: ${commitMessage}`);
          await execAsync(`git commit -m "${commitMessage}"`, { cwd: this.workspacePath });
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
        
        return true;
      } catch (error) {
        this.outputChannel.appendLine(`Error pushing changes: ${error instanceof Error ? error.message : String(error)}`);
        vscode.window.showErrorMessage(`Failed to push changes: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    });
  }

  /**
   * Analyze the current repository and store in vector database
   */
  public async analyzeAndStoreRepository(): Promise<boolean> {
    if (!this.workspacePath) {
      vscode.window.showErrorMessage('No workspace is currently open');
      return false;
    }
    
    const workspacePath = this.workspacePath; // Create a non-nullable reference

    // Show progress dialog
    return await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Analyzing repository',
      cancellable: true
    }, async (progress, token) => {
      try {
        this.outputChannel.show();
        this.outputChannel.appendLine('Analyzing repository and storing in vector database...');

        // Get all source code files recursively
        const allFiles = await this.getAllSourceFiles(workspacePath);
        const totalFiles = allFiles.length;
        
        if (totalFiles === 0) {
          this.outputChannel.appendLine('No source code files found in the repository');
          return false;
        }

        this.outputChannel.appendLine(`Found ${totalFiles} source code files to analyze`);
        
        // Initialize vector store if needed
        await initializeVectorStore();
        
        // Process files in batches to avoid overwhelming the system
        const batchSize = 10;
        for (let i = 0; i < totalFiles; i += batchSize) {
          if (token.isCancellationRequested) {
            this.outputChannel.appendLine('Analysis cancelled by user');
            return false;
          }
          
          const batch = allFiles.slice(i, i + batchSize);
          
          // Process batch
          for (const filePath of batch) {
            try {
              const relativePath = path.relative(workspacePath, filePath);
              progress.report({ 
                message: `Processing ${relativePath}`,
                increment: (batchSize / totalFiles) * 100
              });
              
              // Read file content
              const content = await fs.promises.readFile(filePath, 'utf8');
              
              // Skip empty files or files that are too large
              if (!content.trim() || content.length > 100000) {
                continue;
              }
              
              // Add to vector store
              await addToVectorStore({
                path: relativePath,
                content: content,
                type: path.extname(filePath).substring(1) // Remove the dot from extension
              });
              
              this.outputChannel.appendLine(`Indexed: ${relativePath}`);
            } catch (error) {
              this.outputChannel.appendLine(`Error processing file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }

        this.outputChannel.appendLine('Repository analysis and indexing completed!');
        vscode.window.showInformationMessage('Repository has been analyzed and indexed for improved Claude assistance');
        
        return true;
      } catch (error) {
        this.outputChannel.appendLine(`Error analyzing repository: ${error instanceof Error ? error.message : String(error)}`);
        vscode.window.showErrorMessage(`Failed to analyze repository: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    });
  }

  /**
   * Get all source code files in the repository
   */
  private async getAllSourceFiles(dirPath: string): Promise<string[]> {
    const sourceExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', 
      '.cs', '.go', '.rb', '.php', '.swift', '.kt', '.rs', '.html', '.css', '.scss',
      '.json', '.md', '.yaml', '.yml'
    ];
    
    const ignoreDirs = [
      'node_modules', '.git', 'dist', 'build', '.next', '.vscode', 'venv', 
      '__pycache__', 'bin', 'obj', 'target', '.idea'
    ];
    
    const result: string[] = [];
    
    // Read all entries in the directory
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Skip ignored directories
        if (ignoreDirs.includes(entry.name)) {
          continue;
        }
        
        // Recursively process subdirectories
        const subDirFiles = await this.getAllSourceFiles(fullPath);
        result.push(...subDirFiles);
      } else if (entry.isFile()) {
        // Check if the file has a source code extension
        const ext = path.extname(entry.name).toLowerCase();
        if (sourceExtensions.includes(ext)) {
          result.push(fullPath);
        }
      }
    }
    
    return result;
  }
}

// GitHubService singleton instance
let githubService: GitHubService | undefined;

/**
 * Get the GitHub service instance
 */
export function getGitHubService(): GitHubService {
  if (!githubService) {
    githubService = new GitHubService();
  }
  return githubService;
}