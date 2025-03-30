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
exports.setupCodeAssistantCommands = setupCodeAssistantCommands;
exports.askClaudeMCP = askClaudeMCP;
exports.handleToolUse = handleToolUse;
// Main code assistance functionality
const vscode = __importStar(require("vscode"));
const project_analyzer_1 = require("./project-analyzer");
const tools_1 = require("../models/tools");
const configuration_1 = require("../config/configuration");
const file_utils_1 = require("../utils/file-utils");
const analyze_code_1 = require("./tools/analyze-code");
const refactoring_1 = require("./tools/refactoring");
const docs_search_1 = require("./tools/docs-search");
/**
 * Set up commands for code assistance
 */
function setupCodeAssistantCommands(context) {
    const askClaudeMCPCommand = vscode.commands.registerCommand('claudeAssistant.askClaudeMCP', askClaudeMCP);
    context.subscriptions.push(askClaudeMCPCommand);
}
/**
 * Ask Claude using MCP for code assistance
 */
async function askClaudeMCP() {
    if (!(0, configuration_1.isClientConfigured)()) {
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
    if (!question)
        return;
    // Create and show the output channel
    const outputChannel = vscode.window.createOutputChannel('Claude Assistant MCP');
    outputChannel.show();
    outputChannel.appendLine('Thinking...');
    try {
        // Build the context for Claude
        const formattedContext = await (0, project_analyzer_1.buildContext)(currentFile, currentContent, selection);
        // Initial user message with context
        const userMessage = {
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: `I need help with the following question: ${question}\n\nHere is context from my current project:\n\n${formattedContext}`
                }
            ]
        };
        const anthropic = (0, configuration_1.getAnthropicClient)();
        const config = (0, configuration_1.getConfig)();
        if (!anthropic || !config) {
            throw new Error('Anthropic client not properly configured');
        }
        // Create conversation with MCP tools
        const mcpConversation = await anthropic.messages.create({
            model: config.model,
            max_tokens: config.maxTokens,
            messages: [userMessage],
            tools: tools_1.availableTools
        });
        // Handle the response
        let response = '';
        if (mcpConversation.content && mcpConversation.content.length > 0) {
            // Process each content block
            for (const contentBlock of mcpConversation.content) {
                if ('text' in contentBlock) {
                    response += contentBlock.text + '\n\n';
                }
                else if ('type' in contentBlock) {
                    if (contentBlock.type === 'tool_use') {
                        // A tool was used
                        const toolResult = await handleToolUse(contentBlock, currentFile, fileLanguage);
                        response += `[Used tool: ${contentBlock.name}]\n${toolResult}\n\n`;
                    }
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
    }
    catch (error) {
        console.error('Error in Claude Assistant MCP:', error);
        outputChannel.appendLine(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Handle tool use requests from Claude
 */
async function handleToolUse(toolUse, currentFile, fileLanguage) {
    if (!toolUse.name || !toolUse.input) {
        return "Error: Tool use missing name or input";
    }
    const language = toolUse.input.language || fileLanguage || (0, file_utils_1.getFileLanguage)(currentFile);
    switch (toolUse.name) {
        case "analyze_code":
            return (0, analyze_code_1.analyzeCode)(toolUse.input.code, language);
        case "suggest_refactoring":
            return (0, refactoring_1.suggestRefactoring)(toolUse.input.code, toolUse.input.issues || []);
        case "search_docs":
            return (0, docs_search_1.searchDocs)(toolUse.input.query, language);
        default:
            return `Unknown tool: ${toolUse.name}`;
    }
}
//# sourceMappingURL=code-assistant.js.map