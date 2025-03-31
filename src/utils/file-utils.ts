// src/utils/file-utils.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Check if a file is a text file that should be cached
 */
export function isTextFile(filePath: string): boolean {
  const textExtensions = [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.cs', 
    '.html', '.css', '.scss', '.json', '.md', '.txt', '.yaml', '.yml', '.xml', 
    '.sh', '.bash', '.zsh', '.ps1', '.go', '.php', '.rb', '.rs', '.swift'
  ];
  
  return textExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
}

/**
 * Check if a directory should be skipped during scanning
 */
export function shouldSkipDirectory(name: string): boolean {
  const skipDirs = [
    'node_modules', '.git', 'dist', 'build', '.next', '.vscode', 'venv', 
    '__pycache__', 'bin', 'obj', 'target', '.idea', '.vs', 'bower_components',
    'coverage', 'out', 'vendor'
  ];
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
export function getRelevantFiles(
  currentFile: string, 
  fileContentsMap: Map<string, string>
): string[] {
  // If no current file or no contents map, return empty array
  if (!currentFile || !fileContentsMap || fileContentsMap.size === 0) {
    return [];
  }
  
  const directory = path.dirname(currentFile);
  const relevantFiles: string[] = [];
  const currentFileName = path.basename(currentFile);
  const currentFileExt = path.extname(currentFile);
  
  // Add files from the same directory with the same extension
  for (const [filePath, _] of fileContentsMap.entries()) {
    const fileName = path.basename(filePath);
    
    // Skip the current file
    if (filePath === currentFile) {
      continue;
    }
    
    // Priority 1: Same directory, similar name
    if (path.dirname(filePath) === directory) {
      // Check if the file has a similar name (e.g., user.ts and user.test.ts)
      const baseName = currentFileName.replace(currentFileExt, '');
      if (fileName.startsWith(baseName) || fileName.includes(baseName)) {
        relevantFiles.push(filePath);
        continue;
      }
    }
    
    // Priority 2: Files that might be imported by the current file
    const currentContent = fileContentsMap.get(currentFile);
    if (currentContent) {
      // Simplistic import detection
      const importPattern = `import .* from ['"].*${path.basename(filePath, path.extname(filePath))}['"]`;
      const requirePattern = `require\\(['"].*${path.basename(filePath, path.extname(filePath))}['"]\\)`;
      
      if (new RegExp(importPattern).test(currentContent) || 
          new RegExp(requirePattern).test(currentContent)) {
        relevantFiles.push(filePath);
        continue;
      }
    }
    
    // Priority 3: Files that import the current file
    const fileContent = fileContentsMap.get(filePath);
    if (fileContent) {
      const currentBaseName = path.basename(currentFile, currentFileExt);
      const importPattern = `import .* from ['"].*${currentBaseName}['"]`;
      const requirePattern = `require\\(['"].*${currentBaseName}['"]\\)`;
      
      if (new RegExp(importPattern).test(fileContent) || 
          new RegExp(requirePattern).test(fileContent)) {
        relevantFiles.push(filePath);
        continue;
      }
    }
  }
  
  // Limit to 5 most relevant files
  return relevantFiles.slice(0, 5);
}

/**
 * Get a simplified file path for display
 */
export function simplifyPath(filePath: string): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return filePath;
  }
  
  // Find the workspace containing this file
  for (const folder of workspaceFolders) {
    const folderPath = folder.uri.fsPath;
    if (filePath.startsWith(folderPath)) {
      return path.relative(folderPath, filePath);
    }
  }
  
  return filePath;
}

/**
 * Generate a unique ID
 */
export function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Get file size in human-readable format
 */
export function getFileSizeString(sizeInBytes: number): string {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  } else if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(2)} KB`;
  } else {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}