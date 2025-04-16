import * as vscode from 'vscode';
import * as path from 'path';
import { loadConfiguration, registerConfigListeners } from './config/configuration';
import { setupChatCommands, setWebViewManager } from './chat/chat-manager';
import { setupCodeAssistantCommands } from './code-assistant/code-assistant';
import { setupProjectAnalyzer } from './code-assistant/project-analyzer';
import { WebViewManager } from './chat/chat-view';
import { EnhancedChatViewManager } from './chat/enhanced-chat-view';
import { getGitHubService } from './github/github-service';
import { initializeVectorStore } from './chat/vector-store';
import { registerGitHubPanel } from './github/github-panel';
import { getCodeFileManager } from './utils/code-file-manager';
import { getFileService } from './utils/file-service';
import { registerFileManagerPanel } from './file-manager/file-panel';
import { registerFileButtonHandlers } from './chat/chat-ui-file-button';

// Store global state
export let globalState: {
  context?: vscode.ExtensionContext;
  webViewManager?: WebViewManager;
  enhancedChatViewManager?: EnhancedChatViewManager;
} = {};

export function activate(context: vscode.ExtensionContext) {
  // Enable extensive logging
  console.log('Claude Coding Assistant is now active');
  console.log(`Activation timestamp: ${new Date().toISOString()}`);

  try {
    // Store extension context for use across modules
    globalState.context = context;
    console.log('Context stored in global state');
    
    // Initialize the WebView managers
    console.log('Initializing WebView managers...');
    globalState.webViewManager = new WebViewManager(context);
    globalState.enhancedChatViewManager = new EnhancedChatViewManager(context);
    console.log('WebView managers initialized');
    
    // Share the WebView manager with chat manager
    console.log('Setting WebView manager in chat manager...');
    setWebViewManager(globalState.webViewManager);
    console.log('WebView manager set in chat manager');

    // Load configuration and initialize API clients
    console.log('Loading configuration...');
    loadConfiguration();
    console.log('Configuration loaded');
    
    // Register config change listeners
    console.log('Registering config listeners...');
    registerConfigListeners(context);
    console.log('Config listeners registered');

    // Initialize vector store
    console.log('Initializing vector store...');
    initializeVectorStore(context).catch(error => {
      console.error('Failed to initialize vector store:', error);
    });
    console.log('Vector store initialization triggered');

    // Initialize code file manager
    console.log('Initializing code file manager...');
    getCodeFileManager();
    console.log('Code file manager initialized');

    // Register commands for chat interface
    console.log('Setting up chat commands...');
    setupChatCommands(context);
    console.log('Chat commands setup complete');
    
    // Register direct chat command (for debugging)
    console.log('Registering open chat direct command...');
    const openChatViewDirectCommand = vscode.commands.registerCommand(
      'claudeAssistant.openChatViewDirect', 
      () => {
        console.log('Direct chat command triggered');
        if (globalState.webViewManager) {
          globalState.webViewManager.openChatView();
        } else {
          console.error('WebView manager not initialized!');
          vscode.window.showErrorMessage('WebView manager not initialized. Try reloading the window.');
        }
      }
    );
    context.subscriptions.push(openChatViewDirectCommand);
    console.log('Open chat direct command registered');
    
    // Register command for enhanced chat view
    console.log('Registering enhanced chat command...');
    const openEnhancedChatCommand = vscode.commands.registerCommand(
      'claudeAssistant.openEnhancedChat',
      () => {
        console.log('Enhanced chat command triggered');
        if (globalState.enhancedChatViewManager) {
          globalState.enhancedChatViewManager.openChatView();
        } else {
          console.error('Enhanced chat view manager not initialized!');
          vscode.window.showErrorMessage('Enhanced chat view manager not initialized. Try reloading the window.');
        }
      }
    );
    context.subscriptions.push(openEnhancedChatCommand);
    console.log('Enhanced chat command registered');
    
    // Register unified code-assistant command
    console.log('Registering unified code assistant command...');
    const unifiedCodeAssistantCommand = vscode.commands.registerCommand(
      'claudeAssistant.unifiedCodeAssistant',
      () => {
        console.log('Unified code assistant command triggered');
        if (globalState.enhancedChatViewManager) {
          globalState.enhancedChatViewManager.openChatView();
        } else {
          console.error('Enhanced chat view manager not initialized!');
          vscode.window.showErrorMessage('Enhanced chat view manager not initialized. Try reloading the window.');
        }
      }
    );
    context.subscriptions.push(unifiedCodeAssistantCommand);
    console.log('Unified code assistant command registered');
    
    // Register commands for code assistance
    console.log('Setting up code assistant commands...');
    setupCodeAssistantCommands(context);
    console.log('Code assistant commands setup complete');
    
    // Set up project analyzer
    console.log('Setting up project analyzer...');
    setupProjectAnalyzer(context);
    console.log('Project analyzer setup complete');
    
    // Register GitHub integration commands
    console.log('Registering GitHub commands...');
    registerGitHubCommands(context);
    console.log('GitHub commands registered');
    
    // Register GitHub panel
    console.log('Registering GitHub panel...');
    registerGitHubPanel(context);
    console.log('GitHub panel registered');
    
    // Register File Manager panel
    console.log('Registering File Manager panel...');
    registerFileManagerPanel(context);
    console.log('File Manager panel registered');
    
    // Register file operations command
    console.log('Registering file operations command...');
    registerFileOperationsCommand(context);
    console.log('File operations command registered');

    // Register editor context tracking
    console.log('Registering editor context tracking...');
    registerEditorContextTracking(context);
    console.log('Editor context tracking registered');
    
    console.log('All commands and views registered, activation complete!');
    vscode.window.showInformationMessage('Claude Coding Assistant is now active');
  } catch (error) {
    console.error('Error during extension activation:', error);
    vscode.window.showErrorMessage(`Claude Coding Assistant failed to activate: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Register file operations command
 */
function registerFileOperationsCommand(context: vscode.ExtensionContext) {
  // Register command to handle file operations from anywhere in the extension
  const createUpdateFileCommand = vscode.commands.registerCommand(
    'claudeAssistant.createOrUpdateFile',
    async (params?: { fileName?: string, content?: string }) => {
      console.log('Create/Update file command triggered');
      
      try {
        const fileService = getFileService();
        
        // Get fileName from params or prompt user
        let fileName = params?.fileName;
        if (!fileName) {
          fileName = await vscode.window.showInputBox({
            prompt: 'Enter the file name',
            placeHolder: 'e.g., extension.ts'
          });
          
          if (!fileName) {
            // User cancelled
            return;
          }
        }
        
        // Search for the file
        const existingFilePath = await fileService.searchForFile(fileName);
        
        // Get content from params, editor, or prompt user
        let content = params?.content;
        if (!content) {
          const editor = vscode.window.activeTextEditor;
          if (editor && editor.selection && !editor.selection.isEmpty) {
            // Use selected text if there's a selection
            content = editor.document.getText(editor.selection);
          } else {
            // If the file exists, get its current content as default
            if (existingFilePath) {
              try {
                content = await fileService.loadFileContent(existingFilePath);
              } catch (error) {
                console.error('Error loading file content:', error);
              }
            }
            
            // Open an untitled document for editing if no content provided
            const document = await vscode.workspace.openTextDocument({
              content: content || '',
              language: getLanguageFromFileName(fileName)
            });
            
            const editor = await vscode.window.showTextDocument(document);
            
            // Show message with instructions
            const action = existingFilePath ? 'update' : 'create';
            const targetPath = existingFilePath || fileService.suggestFilePath(fileName, '');
            
            const result = await vscode.window.showInformationMessage(
              `Edit content and press Save to ${action} the file at: ${targetPath}`,
              'Save and Create'
            );
            
            if (result === 'Save and Create') {
              content = editor.document.getText();
              // Close the temporary document
              await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            } else {
              return; // User cancelled
            }
          }
        }
        
        if (!content) {
          vscode.window.showWarningMessage('No content provided for the file.');
          return;
        }
        
        // Create or update the file
        let targetPath: string;
        let resultMessage: string;
        
        if (existingFilePath) {
          // Update existing file
          targetPath = existingFilePath;
          await fileService.createOrUpdateFile(targetPath, content);
          resultMessage = `File updated: ${targetPath}`;
        } else {
          // Create new file in suggested location
          targetPath = fileService.suggestFilePath(fileName, content);
          
          // Ask user to confirm location
          const confirmed = await vscode.window.showQuickPick(
            ['Yes', 'No', 'Choose different location'],
            { placeHolder: `Create file at ${targetPath}?` }
          );
          
          if (confirmed === 'No') {
            return;
          } else if (confirmed === 'Choose different location') {
            // Let user choose location
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (!workspaceRoot) {
              vscode.window.showErrorMessage('No workspace folder is open');
              return;
            }
            
            const targetUri = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.joinPath(workspaceRoot, fileName),
              saveLabel: 'Create File'
            });
            
            if (!targetUri) {
              return; // User cancelled
            }
            
            targetPath = targetUri.fsPath;
          }
          
          await fileService.createOrUpdateFile(targetPath, content);
          resultMessage = `File created: ${targetPath}`;
        }
        
        vscode.window.showInformationMessage(resultMessage);
      } catch (error) {
        console.error('Error in createOrUpdateFile command:', error);
        vscode.window.showErrorMessage(`Failed to create/update file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
  
  context.subscriptions.push(createUpdateFileCommand);
}

/**
 * Register GitHub integration commands
 */
function registerGitHubCommands(context: vscode.ExtensionContext) {
  // Clone repository command
  const cloneCommand = vscode.commands.registerCommand(
    'claudeAssistant.cloneRepository',
    async () => {
      try {
        console.log('Clone repository command triggered');
        const githubService = getGitHubService();
        await githubService.cloneRepository();
      } catch (error) {
        console.error('Error executing clone repository command:', error);
        vscode.window.showErrorMessage(`Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
  
  // Push changes command
  const pushCommand = vscode.commands.registerCommand(
    'claudeAssistant.pushChanges',
    async () => {
      try {
        console.log('Push changes command triggered');
        const githubService = getGitHubService();
        await githubService.pushChanges();
      } catch (error) {
        console.error('Error executing push changes command:', error);
        vscode.window.showErrorMessage(`Failed to push changes: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
  
  // Push changes with selection command
  const pushChangesWithSelectionCommand = vscode.commands.registerCommand(
    'claudeAssistant.pushChangesWithSelection',
    async () => {
      try {
        console.log('Push changes with selection command triggered');
        const githubService = getGitHubService();
        await githubService.pushChangesWithSelection();
      } catch (error) {
        console.error('Error executing push changes with selection command:', error);
        vscode.window.showErrorMessage(`Failed to push selected changes: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
  
  // Set repository URL command
  const setRepoUrlCommand = vscode.commands.registerCommand(
    'claudeAssistant.setRepositoryUrl',
    async () => {
      try {
        console.log('Set repository URL command triggered');
        const githubService = getGitHubService();
        // Get current URL as default
        const currentUrl = await githubService.getCurrentRepoUrl() || '';
        
        // Prompt user for new URL
        const newUrl = await vscode.window.showInputBox({
          prompt: 'Enter GitHub repository URL',
          placeHolder: 'https://github.com/username/repository.git',
          value: currentUrl
        });
        
        if (newUrl) {
          await githubService.setRepositoryUrl(newUrl);
        }
      } catch (error) {
        console.error('Error executing set repository URL command:', error);
        vscode.window.showErrorMessage(`Failed to set repository URL: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // Register GitHub integration commands
  const showCommitHistoryCommand = vscode.commands.registerCommand(
    'claudeAssistant.showCommitHistory',
    async () => {
      try {
        console.log('Show commit history command triggered');
        const githubService = getGitHubService();
        await githubService.showCommitHistory();
      } catch (error) {
        console.error('Error executing show commit history command:', error);
        vscode.window.showErrorMessage(`Failed to show commit history: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
  
  const listPullRequestsCommand = vscode.commands.registerCommand(
    'claudeAssistant.listPullRequests',
    async () => {
      try {
        console.log('List pull requests command triggered');
        const githubService = getGitHubService();
        await githubService.listPullRequests();
      } catch (error) {
        console.error('Error executing list pull requests command:', error);
        vscode.window.showErrorMessage(`Failed to list pull requests: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
  
  const createPullRequestCommand = vscode.commands.registerCommand(
    'claudeAssistant.createPullRequest',
    async () => {
      try {
        console.log('Create pull request command triggered');
        const githubService = getGitHubService();
        await githubService.createPullRequest();
      } catch (error) {
        console.error('Error executing create pull request command:', error);
        vscode.window.showErrorMessage(`Failed to create pull request: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
  
  // Show GitHub logs command
  const showGitHubLogsCommand = vscode.commands.registerCommand(
    'claudeAssistant.showGitHubLogs',
    () => {
      try {
        console.log('Show GitHub logs command triggered');
        const githubService = getGitHubService();
        githubService.showLogs();
      } catch (error) {
        console.error('Error executing show GitHub logs command:', error);
        vscode.window.showErrorMessage(`Failed to show GitHub logs: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
  
  // Clear GitHub logs command
  const clearGitHubLogsCommand = vscode.commands.registerCommand(
    'claudeAssistant.clearGitHubLogs',
    () => {
      try {
        console.log('Clear GitHub logs command triggered');
        const githubService = getGitHubService();
        githubService.clearLogs();
      } catch (error) {
        console.error('Error executing clear GitHub logs command:', error);
        vscode.window.showErrorMessage(`Failed to clear GitHub logs: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // Add commands to subscriptions
  context.subscriptions.push(
    cloneCommand, 
    pushCommand, 
    pushChangesWithSelectionCommand,
    setRepoUrlCommand, 
    showCommitHistoryCommand, 
    listPullRequestsCommand,
    createPullRequestCommand,
    showGitHubLogsCommand,
    clearGitHubLogsCommand
  );
  
  console.log('All GitHub commands registered successfully');
}

/**
 * Register tracking of editor context for enhanced chat
 */
function registerEditorContextTracking(context: vscode.ExtensionContext) {
  console.log('Setting up editor context tracking');
  
  // Track active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      console.log('Active editor changed');
      if (editor && globalState.enhancedChatViewManager) {
        // Update enhanced chat with editor context
        globalState.enhancedChatViewManager.updateEditorContext(editor);
      }
    })
  );
  
  // Track selection changes
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(event => {
      if (event.textEditor && globalState.enhancedChatViewManager) {
        // Update enhanced chat with selection context
        globalState.enhancedChatViewManager.updateSelectionContext(event.textEditor);
      }
    })
  );
  
  // Track document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === event.document && globalState.enhancedChatViewManager) {
        // Update enhanced chat with document changes
        globalState.enhancedChatViewManager.updateDocumentContext(editor);
      }
    })
  );
  
  // Register command to insert text at cursor
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeAssistant.insertAtCursor', (text: string) => {
      console.log('Insert at cursor command triggered');
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        editor.edit(editBuilder => {
          editBuilder.insert(editor.selection.active, text);
        });
      }
    })
  );
  
  console.log('Editor context tracking registered successfully');
}

/**
 * Get language ID from file name
 */
function getLanguageFromFileName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  
  switch (ext) {
    case '.ts':
      return 'typescript';
    case '.js':
      return 'javascript';
    case '.json':
      return 'json';
    case '.md':
      return 'markdown';
    case '.py':
      return 'python';
    case '.html':
      return 'html';
    case '.css':
      return 'css';
    case '.scss':
      return 'scss';
    case '.jsx':
      return 'javascriptreact';
    case '.tsx':
      return 'typescriptreact';
    default:
      return 'plaintext';
  }
}

export function deactivate() {
  // Clean up resources
  console.log('Deactivating Claude Coding Assistant...');
  
  try {
    if (globalState.webViewManager) {
      console.log('Disposing WebView manager');
      globalState.webViewManager.dispose();
    }
    
    if (globalState.enhancedChatViewManager) {
      console.log('Disposing enhanced chat view manager');
      globalState.enhancedChatViewManager.dispose();
    }
    
    console.log('Claude Coding Assistant has been deactivated');
  } catch (error) {
    console.error('Error during extension deactivation:', error);
  }
}