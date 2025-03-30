"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupProjectAnalyzer = setupProjectAnalyzer;
exports.analyzeProject = analyzeProject;
exports.buildContext = buildContext;
// Project scanning and analysis
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const interfaces_1 = require("../models/interfaces");
const file_utils_1 = require("../utils/file-utils");
/**
 * Set up project analyzer with file watchers
 */
function setupProjectAnalyzer(context) {
    // Register file system watcher to keep file content cache up to date
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
    fileWatcher.onDidCreate(uri => (0, file_utils_1.updateFileContent)(uri));
    fileWatcher.onDidChange(uri => (0, file_utils_1.updateFileContent)(uri));
    fileWatcher.onDidDelete(uri => interfaces_1.globalState.fileContents?.delete(uri.fsPath));
    // Add to subscriptions
    context.subscriptions.push(fileWatcher);
    // Register command to analyze the project
    const analyzeProjectCommand = vscode.commands.registerCommand('claudeAssistant.analyzeProject', analyzeProject);
    context.subscriptions.push(analyzeProjectCommand);
    // Initial project analysis
    analyzeProject();
}
/**
 * Analyze the current project structure
 */
async function analyzeProject() {
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
    interfaces_1.globalState.projectInfo = {};
    interfaces_1.globalState.fileContents?.clear();
    for (const folder of workspaceFolders) {
        interfaces_1.globalState.projectInfo[folder.name] = await scanDirectory(folder.uri.fsPath);
    }
}
/**
 * Scan a directory recursively
 */
async function scanDirectory(directoryPath) {
    const dirStructure = { files: [], directories: {} };
    try {
        const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(directoryPath, entry.name);
            // Skip node_modules, .git, and other common excluded directories
            if (entry.isDirectory()) {
                if ((0, file_utils_1.shouldSkipDirectory)(entry.name)) {
                    continue;
                }
                dirStructure.directories[entry.name] = await scanDirectory(fullPath);
            }
            else {
                dirStructure.files.push(entry.name);
                // Cache file content if it's a text file and not too large
                if ((0, file_utils_1.isTextFile)(entry.name)) {
                    try {
                        const stats = await fs.promises.stat(fullPath);
                        if (stats.size < 1024 * 1024) { // Skip files larger than 1MB
                            const content = await fs.promises.readFile(fullPath, 'utf-8');
                            interfaces_1.globalState.fileContents?.set(fullPath, content);
                        }
                    }
                    catch (error) {
                        console.error(`Error reading file ${fullPath}:`, error);
                    }
                }
            }
        }
    }
    catch (error) {
        console.error(`Error scanning directory ${directoryPath}:`, error);
    }
    return dirStructure;
}
/**
 * Build context from the current file and project
 */
async function buildContext(currentFile, currentContent, selection) {
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
            const content = interfaces_1.globalState.fileContents?.get(filePath);
            if (content) {
                formattedContext += `### ${path.basename(filePath)}\n\n`;
                formattedContext += "```\n" + content + "\n```\n\n";
            }
        }
    }
    // Project structure summary
    formattedContext += "## Project Structure\n\n";
    formattedContext += "```\n" + JSON.stringify(interfaces_1.globalState.projectInfo, null, 2) + "\n```\n\n";
    return formattedContext;
}
/**
 * Get relevant files for the current file
 */
function getRelevantFiles(currentFile) {
    // Implementation moved to file-utils.ts
    return [];
}
//# sourceMappingURL=project-analyzer.js.map