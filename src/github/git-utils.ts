// src/github/git-utils.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Promisify exec for async/await usage
export const execAsync = promisify(exec);

/**
 * Check if git is installed
 */
export async function isGitInstalled(): Promise<boolean> {
  try {
    await execAsync('git --version');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if the current directory is a git repository
 */
export async function isGitRepository(workspacePath?: string): Promise<boolean> {
  if (!workspacePath) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return false;
    }
    workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  }

  try {
    await execAsync('git rev-parse --is-inside-work-tree', { cwd: workspacePath });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get the current repository URL
 */
export async function getCurrentRepoUrl(workspacePath?: string): Promise<string | undefined> {
  if (!workspacePath) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return undefined;
    }
    workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  }
  
  try {
    // Check if this is a git repository
    await execAsync('git rev-parse --is-inside-work-tree', { cwd: workspacePath });
    
    // Get remote URL
    const { stdout } = await execAsync('git config --get remote.origin.url', { 
      cwd: workspacePath 
    });
    
    return stdout.trim();
  } catch (error) {
    // Not a git repository or no remote
    return undefined;
  }
}

/**
 * Extract owner and repo name from GitHub URL
 */
export function extractRepoInfoFromUrl(url: string): { owner: string; repo: string } | null {
  // Handle different formats of GitHub URLs
  let match;
  
  // HTTPS format: https://github.com/owner/repo.git
  match = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)(\.git)?$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  
  // SSH format: git@github.com:owner/repo.git
  match = url.match(/git@github\.com:([^\/]+)\/([^\/\.]+)(\.git)?$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  
  return null;
}

/**
 * Check if a remote exists
 */
export async function remoteExists(remoteName: string, workspacePath?: string): Promise<boolean> {
  if (!workspacePath) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return false;
    }
    workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  }

  try {
    await execAsync(`git remote get-url ${remoteName}`, { cwd: workspacePath });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(workspacePath?: string): Promise<string | undefined> {
  if (!workspacePath) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return undefined;
    }
    workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  }

  try {
    const { stdout } = await execAsync('git branch --show-current', { cwd: workspacePath });
    return stdout.trim();
  } catch (error) {
    return undefined;
  }
}

/**
 * Check if there are uncommitted changes
 */
export async function hasUncommittedChanges(workspacePath?: string): Promise<boolean> {
  if (!workspacePath) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return false;
    }
    workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  }

  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd: workspacePath });
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Store git credentials securely
 */
export async function storeGitCredentials(
  username: string, 
  token: string, 
  workspacePath?: string
): Promise<boolean> {
  if (!workspacePath) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return false;
    }
    workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  }

  try {
    // Set Git credentials using the personal access token
    // Use credential helper to store the credentials
    await execAsync(`git config --global credential.helper store`, { cwd: workspacePath });
    
    // Create credentials string in the proper format
    const credentialInput = `protocol=https\nhost=github.com\nusername=${username}\npassword=${token}\n`;
    
    // Use a temporary file to avoid exposing token in command line
    const tempFile = path.join(os.tmpdir(), `git-credentials-${Date.now()}`);
    fs.writeFileSync(tempFile, credentialInput);
    
    // Execute git credential store
    await execAsync(`git credential approve < "${tempFile}"`, { cwd: workspacePath });
    
    // Clean up temporary file
    fs.unlinkSync(tempFile);
    
    // Also configure user info
    await execAsync(`git config --global user.name "${username}"`, { cwd: workspacePath });
    await execAsync(`git config --global user.email "${username}@users.noreply.github.com"`, { cwd: workspacePath });
    
    return true;
  } catch (error) {
    console.error('Error storing Git credentials:', error);
    return false;
  }
}