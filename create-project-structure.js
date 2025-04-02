// create-project-structure.js
const fs = require('fs');
const path = require('path');

// Define the project root directory
const rootDir = process.cwd();

// Define the structure to create
const structure = {
  '.gitignore': `# Dependencies
node_modules/
.npm
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build output
dist/
out/
*.vsix

# VS Code specific files
.vscode-test/
*.vsix
.history/

# Environment and configuration
.env
.env.local
.env.*.local
.DS_Store
Thumbs.db

# Temp files
*.tmp
*.bak

# Coverage reports
coverage/

# Logs
logs
*.log

# Editor directories and files
.idea/
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
`,
  'src/github/commit-history-viewer.ts': '', // These files will be created empty
  'src/github/git-utils.ts': '',
  'src/github/github-auth.ts': '',
  'src/github/github-panel.ts': '',
  'src/github/github-pr.ts': '',
  'src/github/github-repo.ts': '',
  'src/github/github-service.ts': '',
};

// Files to remove (optional)
const filesToRemove = [
  'src/services/github-service.ts', // This will be replaced by the new implementation in src/github/
];

// Function to create directory if it doesn't exist
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

// Function to create or update a file
function createOrUpdateFile(filePath, content) {
  const fullPath = path.join(rootDir, filePath);
  const dirPath = path.dirname(fullPath);
  
  ensureDirectoryExists(dirPath);
  
  if (fs.existsSync(fullPath)) {
    console.log(`Updating file: ${filePath}`);
  } else {
    console.log(`Creating file: ${filePath}`);
  }
  
  fs.writeFileSync(fullPath, content);
}

// Function to remove a file
function removeFile(filePath) {
  const fullPath = path.join(rootDir, filePath);
  
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log(`Removed file: ${filePath}`);
  } else {
    console.log(`File not found, skipping: ${filePath}`);
  }
}

// Main execution
console.log('Starting project structure update...');

// Create or update files
Object.entries(structure).forEach(([filePath, content]) => {
  createOrUpdateFile(filePath, content);
});

// Remove files (if specified)
if (process.argv.includes('--remove')) {
  filesToRemove.forEach(filePath => {
    removeFile(filePath);
  });
}

console.log('Project structure update completed!');