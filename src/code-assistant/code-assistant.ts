import * as vscode from 'vscode';
import * as path from 'path';
import { MCPMessage, MCPToolContent } from '../models/interfaces';
import { buildContext } from './project-analyzer';
import { availableTools } from '../models/tools';
import { getAnthropicClient, getConfig, isClientConfigured } from '../config/configuration';
import { getFileLanguage } from '../utils/file-utils';
import { analyzeCode } from './tools/analyze-code';
import { suggestRefactoring } from './tools/refactoring';
import { searchDocs } from './tools/docs-search';
import { generateSourceCode } from './tools/code-generator';

/**
 * Set up commands for code assistance
 */
export function setupCodeAssistantCommands(context: vscode.ExtensionContext) {
  const askClaudeMCPCommand = vscode.commands.registerCommand(
    'claudeAssistant.askClaudeMCP', 
    askClaudeMCP
  );
  
  const generateCodeCommand = vscode.commands.registerCommand(
    'claudeAssistant.generateCode',
    generateCode
  );
  
  context.subscriptions.push(
    askClaudeMCPCommand,
    generateCodeCommand
  );
}

/**
 * Ask Claude using MCP for code assistance
 */
export async function askClaudeMCP() {
  if (!isClientConfigured()) {
    vscode.window.showErrorMessage('Claude API key is not configured');
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
  const outputChannel = vscode.window.createOutputChannel('Claude Assistant MCP');
  outputChannel.show();
  outputChannel.appendLine('Thinking...');

  try {
    // Build the context for Claude
    const formattedContext = await buildContext(currentFile, currentContent, selection);
    
    // Initial user message with context
    const userMessage: MCPMessage = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `I need help with the following question: ${question}\n\nHere is context from my current project:\n\n${formattedContext}`
        }
      ]
    };

    const anthropic = getAnthropicClient();
    const config = getConfig();
    
    if (!anthropic || !config) {
      throw new Error('Anthropic client not properly configured');
    }

    // Create conversation with MCP tools
    const mcpConversation = await anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      messages: [userMessage],
      tools: availableTools
    });

    // Handle the response
    let response = '';
    
    if (mcpConversation.content && mcpConversation.content.length > 0) {
      // Process each content block
      for (const contentBlock of mcpConversation.content) {
        if ('text' in contentBlock) {
          response += contentBlock.text + '\n\n';
        } else if ('type' in contentBlock && contentBlock.type === 'tool_use') {
          // Cast to MCPToolContent and ensure it has an id field
          const toolUseBlock = contentBlock as MCPToolContent;
          if (!toolUseBlock.id && 'name' in contentBlock) {
            // Generate an id if missing
            toolUseBlock.id = `tool-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
          }
          
          // A tool was used
          const toolResult = await handleToolUse(toolUseBlock, currentFile, fileLanguage);
          response += `[Used tool: ${toolUseBlock.name}]\n${toolResult}\n\n`;
        }
      }
    }

    // Display the response
    outputChannel.clear();
    outputChannel.appendLine('Claude Assistant (MCP):');
    outputChannel.appendLine('');
    outputChannel.appendLine(response);
    
    // Log trace for debugging
    console.log('MCP conversation completed successfully');
  } catch (error) {
    console.error('Error in Claude Assistant MCP:', error);
    outputChannel.appendLine(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Handle tool use requests from Claude
 */
export async function handleToolUse(toolUse: MCPToolContent, currentFile: string, fileLanguage: string): Promise<string> {
  if (!toolUse.name || !toolUse.input) {
    return "Error: Tool use missing name or input";
  }

  const language = toolUse.input.language || fileLanguage || getFileLanguage(currentFile);

  switch (toolUse.name) {
    case "analyze_code":
      return analyzeCode(toolUse.input.code, language);
    case "suggest_refactoring":
      return suggestRefactoring(toolUse.input.code, toolUse.input.issues || []);
    case "search_docs":
      return searchDocs(toolUse.input.query, language);
    case "generate_code":
      const code = generateSourceCode(toolUse.input.specification, language);
      
      // Optionally save the code to a file if filename provided
      if (toolUse.input.filename) {
        try {
          await saveGeneratedCode(toolUse.input.filename, code);
          return `## Generated Code (saved to ${toolUse.input.filename})
\`\`\`${language}
${code}
\`\`\``;
        } catch (error) {
          console.error('Error saving generated code:', error);
          return `## Generated Code (could not save to file)
\`\`\`${language}
${code}
\`\`\``;
        }
      }
      
      return `## Generated Code
\`\`\`${language}
${code}
\`\`\``;
    default:
      return `Unknown tool: ${toolUse.name}`;
  }
}

/**
 * Direct command to generate code with Claude
 */
export async function generateCode() {
  if (!isClientConfigured()) {
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
  
  // Get filename (optional)
  const filename = await vscode.window.showInputBox({
    prompt: 'Enter filename for the generated code (optional)',
    placeHolder: `E.g., myFunction.${language === 'typescript' ? 'ts' : language === 'javascript' ? 'js' : language}`
  });
  
  // Create and show the output channel
  const outputChannel = vscode.window.createOutputChannel('Claude Code Generator');
  outputChannel.show();
  outputChannel.appendLine('Generating code...');
  
  try {
    const anthropic = getAnthropicClient();
    const config = getConfig();
    
    if (!anthropic || !config) {
      throw new Error('Anthropic client not properly configured');
    }
    
    // Create a message to Claude asking for code generation
    const response = await anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      messages: [
        {
          role: 'user',
          content: `Please generate a ${language} implementation for the following specification: ${specification}`
        }
      ]
    });
    
    // Extract code from response
    let generatedCode = '';
    if (response.content && response.content.length > 0) {
      for (const contentBlock of response.content) {
        if ('text' in contentBlock && contentBlock.text) {
          // Extract code block from markdown response
          const codeBlockMatch = contentBlock.text.match(/```(?:\w+)?\s*([\s\S]+?)\s*```/);
          if (codeBlockMatch && codeBlockMatch[1]) {
            generatedCode = codeBlockMatch[1];
          } else {
            generatedCode = contentBlock.text;
          }
        }
      }
    }
    
    // If a filename was provided, save the code
    if (filename && generatedCode) {
      try {
        await saveGeneratedCode(filename, generatedCode);
        outputChannel.appendLine(`Code generated and saved to ${filename}`);
      } catch (error) {
        outputChannel.appendLine(`Code generated but could not save to file: ${error}`);
        outputChannel.appendLine('\nGenerated code:');
        outputChannel.appendLine('```');
        outputChannel.appendLine(generatedCode);
        outputChannel.appendLine('```');
      }
    } else if (generatedCode) {
      outputChannel.appendLine('Generated code:');
      outputChannel.appendLine('```');
      outputChannel.appendLine(generatedCode);
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