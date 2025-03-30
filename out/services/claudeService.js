"use strict";
// src/services/claudeService.ts
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeService = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
class ClaudeService {
    apiKey;
    baseUrl = 'https://api.anthropic.com/v1/messages';
    model;
    constructor() {
        // Get configuration values from VS Code settings
        const config = vscode.workspace.getConfiguration('codingAssistant');
        this.apiKey = config.get('apiKey') || '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';
        this.model = config.get('model') || 'claude-3-7-sonnet-20250219';
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('codingAssistant.apiKey')) {
                this.apiKey = vscode.workspace.getConfiguration('codingAssistant').get('apiKey') || '';
            }
            if (e.affectsConfiguration('codingAssistant.model')) {
                this.model = vscode.workspace.getConfiguration('codingAssistant').get('model') || 'claude-3-7-sonnet-20250219';
            }
        });
    }
    /**
     * Validate if the API key is configured
     */
    isConfigured() {
        return !!this.apiKey;
    }
    /**
     * Get coding assistance from Claude API
     * @param prompt The user's query or code to analyze
     * @param code Optional code context
     * @param language Optional programming language
     */
    async getCodingAssistance(prompt, code, language) {
        if (!this.isConfigured()) {
            throw new Error('API key not configured. Please set your Anthropic API key in extension settings.');
        }
        try {
            // Build the system prompt with coding assistant instructions
            let systemPrompt = `You are an expert coding assistant embedded in VS Code. 
            Provide clear, concise, and accurate help with programming tasks.
            Focus on writing clean, efficient, and well-documented code.
            If you provide code, make sure it's properly formatted and follows best practices.`;
            if (language) {
                systemPrompt += ` The user is working with ${language} code.`;
            }
            // Build the user message with context
            let userMessage = prompt;
            if (code) {
                userMessage = `${prompt}\n\nHere's the code I'm working with:\n\`\`\`${language || ''}\n${code}\n\`\`\``;
            }
            // Make the API request
            const response = await axios_1.default.post(this.baseUrl, {
                model: this.model,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: userMessage
                    }
                ],
                max_tokens: 1024
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                }
            });
            return {
                content: response.data.content[0].text,
                model: this.model
            };
        }
        catch (error) {
            console.error('Error calling Claude API:', error);
            if (axios_1.default.isAxiosError(error) && error.response) {
                return {
                    content: '',
                    model: this.model,
                    error: `API Error (${error.response.status}): ${error.response.data.error?.message || 'Unknown error'}`
                };
            }
            else {
                return {
                    content: '',
                    model: this.model,
                    error: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                };
            }
        }
    }
    /**
     * Generate code based on a description
     */
    async generateCode(description, language) {
        const prompt = `Generate ${language} code that does the following: ${description}. 
        Only provide the code without explanations unless the solution requires clarification.`;
        return this.getCodingAssistance(prompt, undefined, language);
    }
    /**
     * Explain code functionality
     */
    async explainCode(code, language) {
        const prompt = "Explain what this code does in a clear and concise way. Include any important details about the algorithms, patterns, or potential issues.";
        return this.getCodingAssistance(prompt, code, language);
    }
    /**
     * Suggest improvements for the provided code
     */
    async suggestImprovements(code, language) {
        const prompt = "Suggest improvements for this code. Focus on performance, readability, and best practices.";
        return this.getCodingAssistance(prompt, code, language);
    }
    /**
     * Fix bugs in the provided code
     */
    async fixBugs(code, error, language) {
        let prompt = "Fix bugs in this code.";
        if (error) {
            prompt += ` Here's the error I'm getting: "${error}"`;
        }
        return this.getCodingAssistance(prompt, code, language);
    }
}
exports.ClaudeService = ClaudeService;
//# sourceMappingURL=claudeService.js.map