// setup-project.js
// This script checks and sets up the project directory structure for the Claude VS Code extension

const fs = require('fs');
const path = require('path');

// Define required project structure
const requiredStructure = {
  src: {
    "extension.ts": null,
    config: {
      "settings.ts": null
    },
    models: {
      "interfaces.ts": null,
      "tools.ts": null
    },
    utils: {
      "file-utils.ts": null,
      "length-control.ts": null
    },
    chat: {
      "chat-ui.ts": null,
      "chat-manager.ts": null,
      "chat-view.ts": null,
      "vector-store": {
        "index.ts": null,
        "embedding.ts": null,
        "storage.ts": null
      }
    },
    "code-assistant": {
      "code-assistant.ts": null,
      "project-analyzer.ts": null,
      tools: {
        "code-generator.ts": null,
        "analyzer.ts": null,
        "refactoring.ts": null,
        "docs-search.ts": null
      }
    }
  },
  "package.json": null,
  "tsconfig.json": null,
  "webpack.config.js": null,
  ".vscode": {
    "launch.json": null,
    "settings.json": null
  }
};

// Template content for essential files
const fileTemplates = {
  "package.json": `{
  "name": "claude-coding-assistant",
  "displayName": "Claude Coding Assistant",
  "description": "VS Code extension integrating Claude AI with Model Control Protocol (MCP) for intelligent coding assistance",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.60.0"
  },
  "categories": [
    "Other",
    "Programming Languages",
    "Snippets"
  ],
  "activationEvents": [
    "onStartupFinished"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "claudeAssistant.askClaudeMCP",
        "title": "Ask Claude (Code Assistant)",
        "category": "Claude Assistant"
      },
      {
        "command": "claudeAssistant.openChatView",
        "title": "Open Claude Chat",
        "category": "Claude Assistant"
      },
      {
        "command": "claudeAssistant.analyzeProject",
        "title": "Analyze Project Structure",
        "category": "Claude Assistant"
      },
      {
        "command": "claudeAssistant.generateCode",
        "title": "Generate Code with Claude",
        "category": "Claude Assistant"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "claude-assistant",
          "title": "Claude Assistant",
          "icon": "$(comment-discussion)"
        }
      ]
    },
    "views": {
      "claude-assistant": [
        {
          "id": "claude-tools",
          "name": "Claude Tools"
        }
      ]
    },
    "viewsWelcome": [
      {
        "view": "claude-tools",
        "contents": "Get help with your code\\n[Open Claude Chat](command:claudeAssistant.openChatView)\\n[Ask About Current File](command:claudeAssistant.askClaudeMCP)\\n[Generate New Code](command:claudeAssistant.generateCode)\\n[Analyze Project](command:claudeAssistant.analyzeProject)"
      }
    ],
    "configuration": {
      "title": "Claude Coding Assistant",
      "properties": {
        "claudeAssistant.apiKey": {
          "type": "string",
          "default": "",
          "description": "API key for Claude"
        },
        "claudeAssistant.model": {
          "type": "string",
          "default": "claude-3-7-sonnet-20250219",
          "enum": [
            "claude-3-7-sonnet-20250219",
            "claude-3-5-sonnet-20240620",
            "claude-3-opus-20240229",
            "claude-3-5-haiku-20240307"
          ],
          "description": "Claude model to use"
        },
        "claudeAssistant.maxContextSize": {
          "type": "number",
          "default": 100000,
          "description": "Maximum number of characters to include in context"
        },
        "claudeAssistant.maxTokens": {
          "type": "number",
          "default": 4000,
          "description": "Maximum number of tokens in Claude's response"
        },
        "claudeAssistant.maxGeneratedFileLength": {
          "type": "number",
          "default": 500,
          "description": "Maximum number of lines to include in a generated code file"
        }
      }
    },
    "keybindings": [
      {
        "command": "claudeAssistant.askClaudeMCP",
        "key": "ctrl+shift+c",
        "mac": "cmd+shift+c",
        "when": "editorTextFocus"
      },
      {
        "command": "claudeAssistant.openChatView",
        "key": "ctrl+shift+q",
        "mac": "cmd+shift+q"
      },
      {
        "command": "claudeAssistant.generateCode",
        "key": "ctrl+shift+g",
        "mac": "cmd+shift+g"
      }
    ],
    "menus": {
      "editor/context": [
        {
          "command": "claudeAssistant.askClaudeMCP",
          "group": "claudeAssistant"
        },
        {
          "command": "claudeAssistant.generateCode",
          "group": "claudeAssistant"
        }
      ],
      "explorer/context": [
        {
          "command": "claudeAssistant.analyzeProject",
          "group": "claudeAssistant"
        }
      ]
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "lint": "eslint src --ext ts",
    "test": "jest"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/minimatch": "^5.1.2",
    "@types/node": "^16.18.0",
    "@types/vscode": "^1.60.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.56.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "glob": "^7.2.3",
    "minimatch": "^3.1.2"
  }
}`,

  "tsconfig.json": `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "dist",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "typeRoots": ["./node_modules/@types", "./src/types"]
  },
  "exclude": ["node_modules", ".vscode-test"]
}`,

  "webpack.config.js": `const path = require('path');

const config = {
  target: 'node',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  }
};

module.exports = config;`,

  "src/extension.ts": `import * as vscode from 'vscode';
import { loadConfiguration } from './config/settings';
import { setupChatCommands, setWebViewManager } from './chat/chat-manager';
import { setupCodeAssistantCommands } from './code-assistant/code-assistant';
import { setupProjectAnalyzer } from './code-assistant/project-analyzer';
import { WebViewManager } from './chat/chat-view';
import { initializeVectorStore } from './chat/vector-store';

// Store global state
export let globalState: {
  context?: vscode.ExtensionContext;
  webViewManager?: WebViewManager;
} = {};

export async function activate(context: vscode.ExtensionContext) {
  console.log('Claude Coding Assistant is now active');

  // Store extension context for use across modules
  globalState.context = context;
  
  // Initialize the WebView manager
  globalState.webViewManager = new WebViewManager(context);
  
  // Share the WebView manager with chat manager
  setWebViewManager(globalState.webViewManager);

  // Load configuration and initialize API clients
  loadConfiguration();

  // Initialize vector store
  await initializeVectorStore(context);

  // Register commands for chat interface
  setupChatCommands(context);
  
  // Register commands for code assistance
  setupCodeAssistantCommands(context);
  
  // Set up project analyzer
  setupProjectAnalyzer(context);
}

export function deactivate() {
  // Clean up resources
  if (globalState.webViewManager) {
    globalState.webViewManager.dispose();
  }
  
  console.log('Claude Coding Assistant has been deactivated');
}`
};

// Function to check if the structure exists
function checkStructureExists(basePath, structure) {
  const missingItems = [];
  
  for (const key in structure) {
    const fullPath = path.join(basePath, key);
    
    // Check if the item exists
    if (!fs.existsSync(fullPath)) {
      missingItems.push(fullPath);
    } else if (structure[key] !== null) {
      // If it's a directory with more structure, recursively check it
      const subMissing = checkStructureExists(fullPath, structure[key]);
      missingItems.push(...subMissing);
    }
  }
  
  return missingItems;
}

// Function to create the structure
function createStructure(basePath, structure) {
  for (const key in structure) {
    const fullPath = path.join(basePath, key);
    
    // Create this item if it doesn't exist
    if (!fs.existsSync(fullPath)) {
      // Is this a file or directory?
      if (structure[key] !== null) {
        // It's a directory
        console.log(`Creating directory: ${fullPath}`);
        fs.mkdirSync(fullPath, { recursive: true });
        
        // Recursively create contents
        createStructure(fullPath, structure[key]);
      } else {
        // It's a file
        console.log(`Creating file: ${fullPath}`);
        
        // Get the relative path from project root
        const relativePath = path.relative(process.cwd(), fullPath);
        
        // Check if we have a template for this file
        if (fileTemplates[relativePath]) {
          fs.writeFileSync(fullPath, fileTemplates[relativePath]);
        } else {
          // Create an empty file with a placeholder comment
          const extension = path.extname(fullPath);
          
          let commentChar = "#";
          let closingComment = "";
          
          if (['.ts', '.js', '.tsx', '.jsx', '.css', '.scss', '.java', '.c', '.cpp', '.cs'].includes(extension)) {
            commentChar = "//";
          } else if (['.html', '.xml'].includes(extension)) {
            commentChar = "<!-- ";
            closingComment = " -->";
          }
          
          const content = `${commentChar} Placeholder file: ${key}${closingComment}\n${commentChar} Created by project structure script${closingComment}`;
          fs.writeFileSync(fullPath, content);
        }
      }
    } else if (structure[key] !== null) {
      // Directory exists, but might need contents
      createStructure(fullPath, structure[key]);
    }
  }
}

// Main execution
console.log(`Checking project structure at: ${process.cwd()}`);
const missingItems = checkStructureExists(process.cwd(), requiredStructure);

if (missingItems.length === 0) {
  console.log("✅ Project structure is complete!");
} else {
  console.log(`Found ${missingItems.length} missing items in project structure:`);
  
  // Show up to 5 missing items for brevity
  for (let i = 0; i < Math.min(5, missingItems.length); i++) {
    console.log(`  - ${missingItems[i]}`);
  }
  
  if (missingItems.length > 5) {
    console.log(`  ... and ${missingItems.length - 5} more.`);
  }
  
  const createMissing = process.argv.includes('--create') || process.argv.includes('-c');
  
  if (createMissing) {
    console.log("\nCreating missing project structure...");
    createStructure(process.cwd(), requiredStructure);
    console.log("✅ Project structure has been created!");
  } else {
    console.log("\nUse --create or -c flag to create the missing structure.");
    console.log("Example: node setup-project.js --create");
  }
}

// Count and summarize structure
function countItems(structure) {
  let files = 0;
  let dirs = 0;
  
  for (const key in structure) {
    if (structure[key] === null) {
      files++;
    } else {
      dirs++;
      const subCounts = countItems(structure[key]);
      files += subCounts.files;
      dirs += subCounts.dirs;
    }
  }
  
  return { files, dirs };
}

const counts = countItems(requiredStructure);
console.log("\nProject Structure Summary:");
console.log(`  - Directories: ${counts.dirs}`);
console.log(`  - Files: ${counts.files}`);
console.log(`  - Total items: ${counts.dirs + counts.files}`);

console.log("\nNext steps:");
console.log("  1. Run 'npm install' to install dependencies");
console.log("  2. Configure your Claude API key in VS Code settings");
console.log("  3. Run 'npm run compile' to build the extension");
console.log("  4. Press F5 to start debugging the extension");