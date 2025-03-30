import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Update the content of a file in the cache
 */
export async function updateFileContent(uri: vscode.Uri, fileContents: Map<string, string>) {
  try {
    const content = await fs.promises.readFile(uri.fsPath, 'utf-8');
    fileContents.set(uri.fsPath, content);
  } catch (error) {
    console.error(`Error reading file ${uri.fsPath}:`, error);
  }
}

/**
 * Check if a file is a text file that should be cached
 */
export function isTextFile(filename: string): boolean {
  const textExtensions = [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.cs', 
    '.html', '.css', '.scss', '.json', '.md', '.txt', '.yaml', '.yml', '.xml', 
    '.sh', '.bash', '.zsh', '.ps1', '.go', '.php', '.rb', '.rs', '.swift'
  ];
  
  return textExtensions.some(ext => filename.endsWith(ext));
}

/**
 * Check if a directory should be skipped during scanning
 */
export function shouldSkipDirectory(name: string): boolean {
  const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.vscode', 'venv', '__pycache__'];
  return skipDirs.includes(name);
}

/**
 * Get the file language from its extension
 */
export function getFileLanguage(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  
  const languageMap: {[key: string]: string} = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.jsx': 'javascriptreact',
    '.tsx': 'typescriptreact',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.cs': 'csharp',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.json': 'json',
    '.md': 'markdown',
    '.go': 'go',
    '.php': 'php',
    '.rb': 'ruby',
    '.rs': 'rust',
    '.swift': 'swift'
  };
  
  return languageMap[extension] || 'plaintext';
}

/**
 * Generate a unique ID
 */
export function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}