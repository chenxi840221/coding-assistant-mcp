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
exports.updateFileContent = updateFileContent;
exports.isTextFile = isTextFile;
exports.shouldSkipDirectory = shouldSkipDirectory;
exports.getFileLanguage = getFileLanguage;
exports.getRelevantFiles = getRelevantFiles;
exports.generateUniqueId = generateUniqueId;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const interfaces_1 = require("../models/interfaces");
/**
 * Update the content of a file in the cache
 */
async function updateFileContent(uri) {
    try {
        const content = await fs.promises.readFile(uri.fsPath, 'utf-8');
        interfaces_1.globalState.fileContents?.set(uri.fsPath, content);
    }
    catch (error) {
        console.error(`Error reading file ${uri.fsPath}:`, error);
    }
}
/**
 * Check if a file is a text file that should be cached
 */
function isTextFile(filename) {
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
function shouldSkipDirectory(name) {
    const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.vscode', 'venv', '__pycache__'];
    return skipDirs.includes(name);
}
/**
 * Get the file language from its extension
 */
function getFileLanguage(filename) {
    const extension = path.extname(filename).toLowerCase();
    const languageMap = {
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
function getRelevantFiles(currentFile) {
    // Simple implementation: return files in the same directory
    if (!currentFile || !interfaces_1.globalState.fileContents)
        return [];
    const directory = path.dirname(currentFile);
    const relevantFiles = [];
    // Find imports and references in the current file
    const currentContent = interfaces_1.globalState.fileContents.get(currentFile);
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
                        if (interfaces_1.globalState.fileContents?.has(withExt)) {
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
            if (!relevantFiles.includes(filePath) && interfaces_1.globalState.fileContents?.has(filePath)) {
                relevantFiles.push(filePath);
            }
        });
    }
    return relevantFiles.slice(0, 10); // Limit to 10 files total
}
/**
 * Generate a unique ID
 */
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
//# sourceMappingURL=file-utils.js.map