// Project scanning and analysis
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { globalState, DirectoryInfo } from '../models/interfaces';
import { isTextFile, shouldSkipDirectory, updateFileContent } from '../utils/file-utils';

/**
 * Set up project analyzer with file watchers
 */
export function setupProjectAnalyzer(context: vscode.ExtensionContext) {
  // Register file system watcher to keep file content cache up to date
  const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
  fileWatcher.onDidCreate(uri => updateFileContent(uri));
  fileWatcher.onDidChange(uri => updateFileContent(uri));
  fileWatcher.onDidDelete(uri => globalState.fileContents?.delete(uri.fsPath));
  
  // Add to subscriptions
  context.subscriptions.push(fileWatcher);

  // Register command to analyze the project
  const analyzeProjectCommand = vscode.commands.registerCommand(
    'claudeAssistant.analyzeProject', 
    analyzeProject
  );
  
  context.subscriptions.push(analyzeProjectCommand);

  // Initial project analysis
  analyzeProject();
}

/**
 * Analyze the current project structure
 */
export async function analyzeProject() {
  return vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Analyzing project structure...",
    cancellable: false
  }, async (progress) => {
    progress.report({ increment: 0 });
    
    await scanWorkspace();
    
    progress.report({ increment: 100 });
    vscode.window.showInformationMessage('Project analysis completed');
  });
}

/**
 * Scan the entire workspace
 */
async function scanWorkspace() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return;
  }

  globalState.projectInfo = {};
  globalState.fileContents?.clear();

  for (const folder of workspaceFolders) {
    globalState.projectInfo[folder.name] = await scanDirectory(folder.uri.fsPath);
  }
}

/**
 * Scan a directory recursively
 */
async function scanDirectory(directoryPath: string): Promise<DirectoryInfo> {
  const dirStructure: DirectoryInfo = { files: [], directories: {} };
  
  try {
    const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);
      
      // Skip node_modules, .git, and other common excluded directories
      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name)) {
          continue;
        }
        dirStructure.directories[entry.name] = await scanDirectory(fullPath);
      } else {
        dirStructure.files.push(entry.name);
        
        // Cache file content if it's a text file and not too large
        if (isTextFile(entry.name)) {
          try {
            const stats = await fs.promises.stat(fullPath);
            if (stats.size < 1024 * 1024) { // Skip files larger than 1MB
              const content = await fs.promises.readFile(fullPath, 'utf-8');
              globalState.fileContents?.set(fullPath, content);
            }
          } catch (error) {
            console.error(`Error reading file ${fullPath}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${directoryPath}:`, error);
  }
  
  return dirStructure;
}

/**
 * Build context from the current file and project
 */
export async function buildContext(currentFile: string, currentContent: string, selection: string): Promise<string> {
  let formattedContext = "# Project Context\n\n";
  
  // Add current file information
  if (currentFile) {
    formattedContext += `## Current File: ${path.basename(currentFile)}\n\n`;
    formattedContext += "```\n" + currentContent + "\n```\n\n";
  }
  
  // Add selected code if any
  if (selection) {
    formattedContext += "## Selected Code\n\n";
    formattedContext += "```\n" + selection + "\n```\n\n";
  }
  
  // Add relevant files
  const relevantFiles = getRelevantFiles(currentFile);
  if (relevantFiles.length > 0) {
    formattedContext += "## Related Files\n\n";
    
    for (const filePath of relevantFiles) {
      const content = globalState.fileContents?.get(filePath);
      if (content) {
        formattedContext += `### ${path.basename(filePath)}\n\n`;
        formattedContext += "```\n" + content + "\n```\n\n";
      }
    }
  }
  
  // Project structure summary
  formattedContext += "## Project Structure\n\n";
  formattedContext += "```\n" + JSON.stringify(globalState.projectInfo, null, 2) + "\n```\n\n";
  
  return formattedContext;
}

/**
 * Get relevant files for the current file
 */
function getRelevantFiles(currentFile: string): string[] {
  // Implementation moved to file-utils.ts
  return [];
}