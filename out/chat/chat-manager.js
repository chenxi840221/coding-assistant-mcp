"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
    if (k2 === undefined) { k2 = k; }
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function () { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function (o, m, k, k2) {
    if (k2 === undefined) { k2 = k; }
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function (o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function (o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function (o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) { ar[ar.length] = k; } }
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) { return mod; }
        var result = {};
        if (mod != null) { for (var k = ownKeys(mod), i = 0; i < k.length; i++) { if (k[i] !== "default") { __createBinding(result, mod, k[i]); } } }
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatSessions = void 0;
exports.setupChatCommands = setupChatCommands;
exports.createChatSession = createChatSession;
exports.getChatSession = getChatSession;
exports.handleChatMessage = handleChatMessage;
exports.clearChatSession = clearChatSession;
exports.deleteChatSession = deleteChatSession;
// Chat session management
const vscode = __importStar(require("vscode"));
const file_utils_1 = require("../utils/file-utils");
const configuration_1 = require("../config/configuration");
const extension_1 = require("../extension");
// Chat sessions storage
exports.chatSessions = new Map();
/**
 * Set up chat commands
 */
function setupChatCommands(context) {
    const openChatViewCommand = vscode.commands.registerCommand('claudeAssistant.openChatView', () => {
        if (extension_1.globalState.webViewManager) {
            extension_1.globalState.webViewManager.openChatView();
        }
    });
    context.subscriptions.push(openChatViewCommand);
}
/**
 * Create a new chat session
 */
function createChatSession(name = 'General Chat') {
    const sessionId = (0, file_utils_1.generateUniqueId)();
    const newSession = {
        id: sessionId,
        name: name,
        messages: [
            {
                role: 'system',
                content: 'You are Claude, an AI assistant by Anthropic. You are helpful, harmless, and honest.'
            }
        ]
    };
    exports.chatSessions.set(sessionId, newSession);
    return newSession;
}
/**
 * Get a chat session by ID or create a new one
 */
function getChatSession(sessionId) {
    if (sessionId && exports.chatSessions.has(sessionId)) {
        return exports.chatSessions.get(sessionId);
    }
    return createChatSession();
}
/**
 * Handle a new chat message
 */
async function handleChatMessage(sessionId, text, onUpdate) {
    // Check if the client is configured
    if (!(0, configuration_1.isClientConfigured)()) {
        vscode.window.showErrorMessage('Claude API key is not configured');
        return;
    }
    const session = getChatSession(sessionId);
    // Add user message to history
    session.messages.push({
        role: 'user',
        content: text
    });
    // Update UI to show the message
    onUpdate(session);
    try {
        // Get Claude client and config
        const anthropic = (0, configuration_1.getAnthropicClient)();
        const config = (0, configuration_1.getConfig)();
        if (!anthropic || !config) {
            throw new Error('Anthropic client not properly configured');
        }
        // Get response from Claude
        const response = await anthropic.messages.create({
            model: config.model,
            max_tokens: config.maxTokens,
            messages: session.messages.map(msg => ({
                role: msg.role === 'system' ? 'system' :
                    msg.role === 'user' ? 'user' :
                        msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            }))
        });
        // Extract response text
        let responseText = '';
        if (response.content && response.content.length > 0) {
            for (const contentBlock of response.content) {
                if ('text' in contentBlock) {
                    responseText += contentBlock.text;
                }
            }
        }
        // Add assistant message to history
        session.messages.push({
            role: 'assistant',
            content: responseText
        });
        // Update UI with the response
        onUpdate(session);
    }
    catch (error) {
        console.error('Error getting response from Claude:', error);
        // Add error message
        session.messages.push({
            role: 'assistant',
            content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : String(error)}`
        });
        // Update UI to show the error
        onUpdate(session);
    }
}
/**
 * Clear a chat session
 */
function clearChatSession(sessionId) {
    const session = getChatSession(sessionId);
    // Keep only the system message
    session.messages = session.messages.filter(msg => msg.role === 'system');
}
/**
 * Delete a chat session
 */
function deleteChatSession(sessionId) {
    return exports.chatSessions.delete(sessionId);
}
//# sourceMappingURL=chat-manager.js.map