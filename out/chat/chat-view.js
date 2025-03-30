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
exports.WebViewManager = void 0;
// WebView implementation for chat
const vscode = __importStar(require("vscode"));
const chat_ui_1 = require("./chat-ui");
const chat_manager_1 = require("./chat-manager");
/**
 * Manages WebView panels for chat UI
 */
class WebViewManager {
    context;
    webViewPanels = new Map();
    constructor(context) {
        this.context = context;
    }
    /**
     * Open a chat view with the given session ID
     */
    openChatView(sessionId) {
        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // If no sessionId is provided, use the general chat ID
        const chatId = sessionId || 'general-chat';
        // Check if we already have a panel for this chat
        const existingPanel = this.webViewPanels.get(chatId);
        if (existingPanel) {
            // If we do, show it
            existingPanel.reveal(columnToShowIn);
            return;
        }
        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel('claudeChat', 'Claude Chat', columnToShowIn || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media')
            ]
        });
        // Get or create chat session
        const session = (0, chat_manager_1.getChatSession)(sessionId);
        // Set the HTML content
        panel.webview.html = (0, chat_ui_1.getChatHTML)();
        // Store the panel reference
        this.webViewPanels.set(chatId, panel);
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    await (0, chat_manager_1.handleChatMessage)(session.id, message.text, (updatedSession) => this.updateChatWebview(panel.webview, updatedSession));
                    break;
                case 'clearChat':
                    (0, chat_manager_1.clearChatSession)(session.id);
                    this.updateChatWebview(panel.webview, session);
                    break;
            }
        }, undefined, this.context.subscriptions);
        // Update the webview with existing messages
        this.updateChatWebview(panel.webview, session);
        // Handle the panel being closed
        panel.onDidDispose(() => {
            this.webViewPanels.delete(chatId);
        }, null, this.context.subscriptions);
    }
    /**
     * Update the chat webview with new messages
     */
    updateChatWebview(webview, session) {
        webview.postMessage({
            command: 'updateChat',
            messages: session.messages.filter(msg => msg.role !== 'system')
        });
    }
    /**
     * Dispose all webview panels
     */
    dispose() {
        this.webViewPanels.forEach(panel => panel.dispose());
        this.webViewPanels.clear();
    }
}
exports.WebViewManager = WebViewManager;
//# sourceMappingURL=chat-view.js.map