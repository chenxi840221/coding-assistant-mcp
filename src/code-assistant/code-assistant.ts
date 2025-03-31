// src/code-assistant/code-assistant.ts

import * as vscode from 'vscode';
import * as path from 'path';
import { buildContext } from './project-analyzer';
import { getClaudeService } from '../services/claude-service';
import { findRelevantContext } from '../chat/vector-store';
import { getFileLanguage } from '../utils/file-utils';

/**
 * Set up commands for code assistance
 */
export function setupCodeAssistantCommands(context: vscode.ExtensionContext) {
  // Register askClaude command
  const askClaudeCommand = vscode.commands.registerCommand(
    'claudeAssistant.askClaudeMCP',
    askClaude
  );
  
  // Register generateCode command
  const generateCodeCommand = vscode.commands.registerCommand(
    'claudeAssistant.generateCode',
    generateCode
  );
  
  // Register analyzeCode command
  const analyzeCodeCommand = vscode.commands.registerCommand(
    'claudeAssistant.analyzeCode',
    analyzeCode
  );
  
  // Add to subscriptions
  context.subscriptions.push(
    askClaudeCommand,
    generateCodeCommand,
    analyzeCodeCommand
  );
}

/**
 * Ask Claude about the current code
 */
async function askClaude() {
  const claudeService = getClaudeService();
  
  if (!claudeService.isConfigured()) {
    vscode.window.showErrorMessage(
      'Claude API key is not configured. Please set your API key in settings.',
      'Open Settings'
    ).then(selection => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand(
          'workbench.action.openSettings', 
          'claudeAssistant.apiKey'
        );
      }
    });
    return;
  }

  const editor = vscode.window.activeTextEditor;
  let currentFile = '';
  let currentContent = '';
  let selection = '';
  let fileLanguage = '';

  if (editor) {
    currentFile = editor.document.fileName;
    currentContent = editor.document.getText();
    selection = editor.document.getText(editor.selection);
    fileLanguage = editor.document.languageId;
  }

  // Get user's question
  const question = await vscode.window.showInputBox({
    prompt: 'What would you like to ask Claude?',
    placeHolder: 'E.g., How do I improve this code?'
  });

  if (!question) return;

  // Create and show the output channel
  const outputChannel = vscode.window.createOutputChannel('Claude Assistant');
  outputChannel.show();
  outputChannel.appendLine('Claude is thinking...');

  try {
    // Find relevant context from vector store
    const relevantDocuments = await findRelevantContext(question);
    
    // Build the context for Claude
    const formattedContext = await buildContext(
      currentFile, 
      currentContent, 
      selection,
      relevantDocuments.map(doc => doc.content)
    );
    
    // Combine question with context
    const fullPrompt = `I need help with the following question: ${question}\n\n${formattedContext}`;
    
    // Get response from Claude
    const response = await claudeService.sendMessage(fullPrompt);
    
    // Display the response
    outputChannel.clear();
    outputChannel.appendLine('Claude Assistant:');
    outputChannel.appendLine('');
    outputChannel.appendLine(response);
  } catch (error) {
    console.error('Error in Claude Assistant:', error);
    outputChannel.appendLine(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate code with Claude
 */
async function generateCode() {
  const claudeService = getClaudeService();
  
  if (!claudeService.isConfigured()) {
    vscode.window.showErrorMessage('Claude API key is not configured');
    return;
  }

  // Get language preference
  const editor = vscode.window.activeTextEditor;
  const language = editor?.document.languageId || 'javascript';
  
  // Get specification from user
  const specification = await vscode.window.showInputBox({
    prompt: 'Describe the code you want to generate',
    placeHolder: 'E.g., A function that sorts an array of objects by a property'
  });
  
  if (!specification) return;
  
  // Get target directory
  let targetDirectory: vscode.Uri | undefined;
  
  // Check if we're in a workspace
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }
  
  const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;
  
  // Try to identify a src directory
  let srcDirectory: vscode.Uri | undefined;
  try {
    const srcPath = vscode.Uri.joinPath(workspaceRoot, 'src');
    const srcStat = await vscode.workspace.fs.stat(srcPath);
    if (srcStat.type === vscode.FileType.Directory) {
      srcDirectory = srcPath;
    }
  } catch (error) {
    // src directory doesn't exist, we'll use root
    console.log('No src directory found, using workspace root');
  }
  
  // Show quick pick with directory options
  const directoryOptions = [
    { 
      label: 'src directory', 
      description: 'Place in the src folder',
      uri: srcDirectory,
    },
    { 
      label: 'workspace root', 
      description: 'Place in the workspace root folder',
      uri: workspaceRoot
    },
    { 
      label: 'current directory', 
      description: 'Place in the directory of the currently open file',
      uri: editor ? vscode.Uri.joinPath(vscode.Uri.file(path.dirname(editor.document.uri.fsPath))) : workspaceRoot
    },
    {
      label: 'choose directory',
      description: 'Select a specific directory',
      uri: undefined
    }
  ].filter(option => option.uri !== undefined || option.label === 'choose directory');
  
  const selectedOption = await vscode.window.showQuickPick(directoryOptions, {
    placeHolder: 'Select where to save the generated code'
  });
  
  if (!selectedOption) return;
  
  // Handle directory selection
  if (selectedOption.label === 'choose directory') {
    const folderUris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Directory'
    });
    
    if (!folderUris || folderUris.length === 0) return;
    targetDirectory = folderUris[0];
  } else {
    targetDirectory = selectedOption.uri as vscode.Uri;
  }
  
  // Get filename
  const filename = await vscode.window.showInputBox({
    prompt: 'Enter filename for the generated code',
    placeHolder: `E.g., myFunction.${language === 'typescript' ? 'ts' : language === 'javascript' ? 'js' : language}`,
    value: `generated.${language === 'typescript' ? 'ts' : language === 'javascript' ? 'js' : language}`
  });
  
  if (!filename) return;
  
  // Create and show the output channel
  const outputChannel = vscode.window.createOutputChannel('Claude Code Generator');
  outputChannel.show();
  outputChannel.appendLine('Generating code...');
  
  try {
    // Generate code with Claude
    const generatedCode = await claudeService.generateCode(specification, language);
    
    // Extract code block from markdown response
    let codeBlock = generatedCode;
    const codeBlockMatch = generatedCode.match(/```(?:\w+)?\s*([\s\S]+?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      codeBlock = codeBlockMatch[1];
    }
    
    // If we have a target directory and filename, save the code
    if (targetDirectory && filename && codeBlock) {
      try {
        // Create file URI
        const fileUri = vscode.Uri.joinPath(targetDirectory, filename);
        
        // Write to file
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(codeBlock, 'utf8'));
        
        outputChannel.appendLine(`Code generated and saved to ${fileUri.fsPath}`);
        
        // Open the file
        await vscode.window.showTextDocument(fileUri);
      } catch (error) {
        outputChannel.appendLine(`Code generated but could not save to file: ${error}`);
        outputChannel.appendLine('\nGenerated code:');
        outputChannel.appendLine('```');
        outputChannel.appendLine(codeBlock);
        outputChannel.appendLine('```');
      }
    } else if (codeBlock) {
      outputChannel.appendLine('Generated code:');
      outputChannel.appendLine('```');
      outputChannel.appendLine(codeBlock);
      outputChannel.appendLine('```');
    } else {
      outputChannel.appendLine('No code was generated. Try refining your specification.');
    }
  } catch (error) {
    console.error('Error generating code:', error);
    outputChannel.appendLine(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Analyze code with Claude
 */
async function analyzeCode() {
  const claudeService = getClaudeService();
  
  if (!claudeService.isConfigured()) {
    vscode.window.showErrorMessage('Claude API key is not configured');
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('No code editor is active');
    return;
  }

  // Get selected code or entire file
  const selection = editor.selection;
  const code = selection.isEmpty 
    ? editor.document.getText() 
    : editor.document.getText(selection);
  
  if (!code) {
    vscode.window.showInformationMessage('No code to analyze');
    return;
  }

  // Get language and file info
  const language = editor.document.languageId;
  const fileName = editor.document.fileName;
  const fileBaseName = path.basename(fileName);

  // Get analysis type options
  const analysisTypes = [
    { 
      label: 'General Analysis', 
      value: 'general',
      description: 'Overall code quality, structure, and improvements'
    },
    { 
      label: 'Performance Review', 
      value: 'performance',
      description: 'Identify performance bottlenecks and optimizations'
    },
    { 
      label: 'Security Check', 
      value: 'security',
      description: 'Check for security vulnerabilities and best practices'
    },
    { 
      label: 'Code Explanation', 
      value: 'explanation',
      description: 'Detailed explanation of what the code does'
    },
    {
      label: 'Test Generation',
      value: 'tests',
      description: 'Generate unit tests for this code'
    }
  ];

  const selectedAnalysis = await vscode.window.showQuickPick(analysisTypes, {
    placeHolder: 'Select analysis type'
  });

  if (!selectedAnalysis) return;

  // Create and show the output channel
  const outputChannel = vscode.window.createOutputChannel('Claude Code Analysis');
  outputChannel.show();
  outputChannel.appendLine(`Analyzing code (${selectedAnalysis.label})...`);

  try {
    // Get related files for context
    const relevantDocuments = await findRelevantContext(code);
    
    // Prepare the prompt based on analysis type
    let prompt = '';
    
    switch (selectedAnalysis.value) {
      case 'general':
        prompt = `Please analyze this ${language} code from ${fileBaseName} and provide insights on:
          1. Code structure and organization
          2. Potential bugs or issues
          3. Performance considerations
          4. Ways to improve readability and maintainability
          5. Best practices I should follow

          Please be specific and provide examples where appropriate.`;
        break;
        
      case 'performance':
        prompt = `Please analyze this ${language} code from ${fileBaseName} for performance issues:
          1. Identify any performance bottlenecks
          2. Suggest specific optimizations
          3. Point out any inefficient algorithms or patterns
          4. Recommend more efficient alternatives
          5. Estimate the performance impact of your suggestions

          Please include code examples for your recommendations.`;
        break;
        
      case 'security':
        prompt = `Please perform a security review of this ${language} code from ${fileBaseName}:
          1. Identify potential security vulnerabilities
          2. Check for common security issues specific to ${language}
          3. Highlight sensitive operations that need additional protection
          4. Recommend security best practices
          5. Suggest specific changes to improve security

          Please be specific about potential attack vectors.`;
        break;
        
      case 'explanation':
        prompt = `Please explain this ${language} code from ${fileBaseName} in detail:
          1. Provide a high-level overview of what the code does
          2. Break down each function/section and explain its purpose
          3. Explain any complex or non-obvious logic
          4. Describe the inputs, outputs, and dependencies
          5. Note any important patterns or techniques used

          Make your explanation appropriate for someone familiar with programming but new to this codebase.`;
        break;
        
      case 'tests':
        prompt = `Please generate unit tests for this ${language} code from ${fileBaseName}:
          1. Identify the key functions or components that need testing
          2. Create comprehensive test cases covering normal usage
          3. Include edge cases and error handling tests
          4. Use appropriate testing frameworks for ${language}
          5. Provide a brief explanation of what each test is checking

          The tests should be complete and ready to use with minimal modifications.`;
        break;
    }
    
    // Build context with any relevant files
    const context = relevantDocuments.length > 0 
      ? "\n\nProject context that might be relevant:\n" + 
        relevantDocuments.map((doc, i) => `Related code ${i+1}:\n\`\`\`\n${doc.content}\n\`\`\`\n`).join("\n")
      : "";
    
    // Send to Claude for analysis
    const response = await claudeService.sendCodeQuery(prompt + context, code, language);
    
    // Display the response
    outputChannel.clear();
    outputChannel.appendLine(`Code Analysis (${selectedAnalysis.label}):`);
    outputChannel.appendLine('');
    outputChannel.appendLine(response);
  } catch (error) {
    console.error('Error analyzing code:', error);
    outputChannel.appendLine(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Save generated code to a file
 */
async function saveGeneratedCode(filename: string, code: string): Promise<void> {
  try {
    // Check if we're in a workspace
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      throw new Error('No workspace folder open');
    }
    
    // Get workspace root
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;
    
    // Create file URI
    const fileUri = vscode.Uri.joinPath(workspaceRoot, filename);
    
    // Write to file
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(code, 'utf8'));
    
    // Open the file
    await vscode.window.showTextDocument(fileUri);
  } catch (error) {
    console.error('Error saving generated code:', error);
    throw error;
  }
}