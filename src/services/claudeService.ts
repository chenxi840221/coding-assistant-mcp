// src/services/claudeService.ts

import * as vscode from 'vscode';
import axios from 'axios';

export interface ClaudeResponse {
    content: string;
    model: string;
    error?: string;
}

export class ClaudeService {
    private apiKey: string;
    private baseUrl: string = 'https://api.anthropic.com/v1/messages';
    private model: string;

    constructor() {
        // Get configuration values from VS Code settings
        const config = vscode.workspace.getConfiguration('codingAssistant');
        this.apiKey = config.get('apiKey') || '';
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
    public isConfigured(): boolean {
        return !!this.apiKey;
    }

    /**
     * Get coding assistance from Claude API
     * @param prompt The user's query or code to analyze
     * @param code Optional code context
     * @param language Optional programming language
     */
    public async getCodingAssistance(
        prompt: string,
        code?: string,
        language?: string
    ): Promise<ClaudeResponse> {
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
            const response = await axios.post(
                this.baseUrl,
                {
                    model: this.model,
                    system: systemPrompt,
                    messages: [
                        {
                            role: 'user',
                            content: userMessage
                        }
                    ],
                    max_tokens: 1024
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.apiKey,
                        'anthropic-version': '2023-06-01'
                    }
                }
            );

            return {
                content: response.data.content[0].text,
                model: this.model
            };
        } catch (error) {
            console.error('Error calling Claude API:', error);
            if (axios.isAxiosError(error) && error.response) {
                return {
                    content: '',
                    model: this.model,
                    error: `API Error (${error.response.status}): ${error.response.data.error?.message || 'Unknown error'}`
                };
            } else {
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
    public async generateCode(
        description: string,
        language: string
    ): Promise<ClaudeResponse> {
        const prompt = `Generate ${language} code that does the following: ${description}. 
        Only provide the code without explanations unless the solution requires clarification.`;
        
        return this.getCodingAssistance(prompt, undefined, language);
    }

    /**
     * Explain code functionality
     */
    public async explainCode(
        code: string,
        language?: string
    ): Promise<ClaudeResponse> {
        const prompt = "Explain what this code does in a clear and concise way. Include any important details about the algorithms, patterns, or potential issues.";
        
        return this.getCodingAssistance(prompt, code, language);
    }

    /**
     * Suggest improvements for the provided code
     */
    public async suggestImprovements(
        code: string,
        language?: string
    ): Promise<ClaudeResponse> {
        const prompt = "Suggest improvements for this code. Focus on performance, readability, and best practices.";
        
        return this.getCodingAssistance(prompt, code, language);
    }

    /**
     * Fix bugs in the provided code
     */
    public async fixBugs(
        code: string,
        error?: string,
        language?: string
    ): Promise<ClaudeResponse> {
        let prompt = "Fix bugs in this code.";
        if (error) {
            prompt += ` Here's the error I'm getting: "${error}"`;
        }
        
        return this.getCodingAssistance(prompt, code, language);
    }
}