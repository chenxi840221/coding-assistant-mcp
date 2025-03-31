// File handling utilities
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { globalState } from '../models/interfaces';

/**
 * Update the content of a file in the cache
 */
export async function updateFileContent(uri: vscode.Uri) {
  try {
    const content = await fs.promises.readFile(uri.fsPath, 'utf-8');
    globalState.fileContents?.set(uri.fsPath, content);
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
 * Get relevant files based on the current file
 */
export function getRelevantFiles(currentFile: string): string[] {
  // Simple implementation: return files in the same directory
  if (!currentFile || !globalState.fileContents) return [];
  
  const directory = path.dirname(currentFile);
  const relevantFiles: string[] = [];
  
  // Find imports and references in the current file
  const currentContent = globalState.fileContents.get(currentFile);
  if (currentContent) {
    // Very simplistic import detection - would need improvement for real usage
    const importMatches = currentContent.match(/import\s+.*?from\s+['"](.+?)['"]/g) || [];
    const requireMatches = currentContent.match(/require\s*\(\s*['"](.+?)['"]\s*\)/g) || [];
    
    // Process matches and resolve file paths
    [...importMatches, ...requireMatches].forEach(match => {
      const importPath = match.match(/['"](.+?)['"]/)?.[1];
      if (importPath) {
        // Try to resolve relative path
        if (importPath.startsWith('.')) {
          const resolvedPath = path.resolve(directory, importPath);
          // Check common extensions
          ['.js', '.ts', '.jsx', '.tsx', '.json'].forEach(ext => {
            const withExt = resolvedPath + ext;
            if (globalState.fileContents?.has(withExt)) {
              relevantFiles.push(withExt);
            }
          });
        }
      }
    });
  }
  
  // Add files from the same directory, limited to 5 additional files
  if (fs.existsSync(directory)) {
    fs.readdirSync(directory)
      .filter(file => file !== path.basename(currentFile) && isTextFile(file))
      .slice(0, 5)
      .forEach(file => {
        const filePath = path.join(directory, file);
        if (!relevantFiles.includes(filePath) && globalState.fileContents?.has(filePath)) {
          relevantFiles.push(filePath);
        }
      });
  }
  
  return relevantFiles.slice(0, 10); // Limit to 10 files total
}

/**
 * Generate a unique ID
 */
export function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}