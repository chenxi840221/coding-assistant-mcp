// create-project-structure.js
// This script analyzes the current project structure and can create any missing directories/files

const fs = require('fs');
const path = require('path');

// Define required project structure
const requiredStructure = {
  src: {
    "extension.ts": null,
    config: {
      "settings.ts": null,
      "configuration.ts": null
    },
    models: {
      "interfaces.ts": null,
      "tools.ts": null
    },
    utils: {
      "file-utils.ts": null,
      "length-control.ts": null,
      "code-file-manager.ts": null
    },
    chat: {
      "chat-ui.ts": null,
      "chat-manager.ts": null,
      "chat-view.ts": null,
      "enhanced-chat-ui": {
        "index.ts": null,
        "styles.ts": null,
        "script.ts": null,
        "utils.ts": null,
        "message-handler.ts": null,
        "integrator.ts": null,
        "components": {
          "header.ts": null,
          "input-area.ts": null,
          "tool-buttons.ts": null,
          "file-tree.ts": null
        }
      },
      "enhanced-chat-view.ts": null,
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
    },
    github: {
      "github-service.ts": null,
      "github-auth.ts": null,
      "github-repo.ts": null,
      "github-pr.ts": null,
      "github-panel.ts": null,
      "git-utils.ts": null,
      "commit-history-viewer.ts": null
    },
    services: {
      "claude-service.ts": null
    },
    types: {
      "anthropic.d.ts": null
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

// Function to check if the structure exists
function checkStructureExists(basePath, structure) {
  const missingItems = [];
  const existingItems = [];
  
  for (const key in structure) {
    const fullPath = path.join(basePath, key);
    
    // Check if the item exists
    if (!fs.existsSync(fullPath)) {
      missingItems.push(fullPath);
    } else {
      existingItems.push(fullPath);
      if (structure[key] !== null) {
        // If it's a directory with more structure, recursively check it
        const result = checkStructureExists(fullPath, structure[key]);
        missingItems.push(...result.missingItems);
        existingItems.push(...result.existingItems);
      }
    }
  }
  
  return { missingItems, existingItems };
}

// Function to analyze the current project structure
function analyzeCurrentStructure(basePath) {
  const structure = {};
  
  if (!fs.existsSync(basePath)) {
    return structure;
  }
  
  const items = fs.readdirSync(basePath);
  
  for (const item of items) {
    const fullPath = path.join(basePath, item);
    
    // Skip node_modules and typical build directories
    if (item === 'node_modules' || item === 'dist' || item === '.git') {
      continue;
    }
    
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory()) {
      structure[item] = analyzeCurrentStructure(fullPath);
    } else {
      structure[item] = null;
    }
  }
  
  return structure;
}

// Function to compare the current structure with the required structure
function compareStructures(current, required) {
  const missing = {};
  const extra = {...current};
  
  for (const key in required) {
    if (key in current) {
      // Item exists in both structures
      if (required[key] === null) {
        // It's a file, so remove it from extras
        delete extra[key];
      } else {
        // It's a directory, so recursively compare
        const result = compareStructures(current[key], required[key]);
        
        if (Object.keys(result.missing).length > 0) {
          missing[key] = result.missing;
        }
        
        // Update the extra structure
        if (Object.keys(result.extra).length > 0) {
          extra[key] = result.extra;
        } else {
          delete extra[key];
        }
      }
    } else {
      // Item is missing
      missing[key] = required[key];
    }
  }
  
  return { missing, extra };
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
    } else if (structure[key] !== null) {
      // Directory exists, but might need contents
      createStructure(fullPath, structure[key]);
    }
  }
}

// Format structure as tree
function formatAsTree(structure, prefix = '', isLast = true) {
  const lines = [];
  const keys = Object.keys(structure);
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const isLastItem = i === keys.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';
    
    lines.push(`${prefix}${connector}${key}`);
    
    if (structure[key] !== null) {
      // It's a directory
      const childLines = formatAsTree(
        structure[key],
        `${prefix}${childPrefix}`,
        isLastItem
      );
      
      lines.push(...childLines);
    }
  }
  
  return lines;
}

// Main execution
console.log(`Analyzing project structure at: ${process.cwd()}`);

// Get current structure
const currentStructure = analyzeCurrentStructure(process.cwd());

// Compare with required structure
const { missing, extra } = compareStructures(currentStructure, requiredStructure);

// Print current structure
console.log("\nCurrent Project Structure:");
console.log(formatAsTree(currentStructure).join('\n'));

// Report missing items
if (Object.keys(missing).length > 0) {
  console.log("\nMissing Items:");
  console.log(formatAsTree(missing).join('\n'));
} else {
  console.log("\n✅ All required items exist!");
}

// Report extra items
if (Object.keys(extra).length > 0) {
  console.log("\nExtra Items (not in required structure):");
  console.log(formatAsTree(extra).join('\n'));
}

// Ask if user wants to create missing items
if (Object.keys(missing).length > 0) {
  const createMissing = process.argv.includes('--create') || process.argv.includes('-c');
  
  if (createMissing) {
    console.log("\nCreating missing project structure...");
    createStructure(process.cwd(), missing);
    console.log("✅ Project structure has been updated!");
  } else {
    console.log("\nUse --create or -c flag to create the missing structure.");
    console.log("Example: node create-project-structure.js --create");
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

const currentCounts = countItems(currentStructure);
const requiredCounts = countItems(requiredStructure);

console.log("\nProject Structure Summary:");
console.log(`  Current Structure: ${currentCounts.dirs} directories, ${currentCounts.files} files, ${currentCounts.dirs + currentCounts.files} total items`);
console.log(`  Required Structure: ${requiredCounts.dirs} directories, ${requiredCounts.files} files, ${requiredCounts.dirs + requiredCounts.files} total items`);

if (Object.keys(missing).length > 0) {
  const missingCounts = countItems(missing);
  console.log(`  Missing: ${missingCounts.dirs} directories, ${missingCounts.files} files, ${missingCounts.dirs + missingCounts.files} total items`);
}

console.log("\nNext steps:");
console.log("  1. Review the current structure and identify any issues");
console.log("  2. Run with --create flag to create any missing items");
console.log("  3. Run 'npm install' to install dependencies");
console.log("  4. Run 'npm run compile' to build the extension");