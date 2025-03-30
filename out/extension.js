"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalState = void 0;
exports.activate = activate;
exports.deactivate = deactivate;
const configuration_1 = require("./config/configuration");
const chat_manager_1 = require("./chat/chat-manager");
const code_assistant_1 = require("./code-assistant/code-assistant");
const project_analyzer_1 = require("./code-assistant/project-analyzer");
const chat_view_1 = require("./chat/chat-view");
// Store global state
exports.globalState = {};
function activate(context) {
    console.log('Claude Coding Assistant is now active');
    // Store extension context for use across modules
    exports.globalState.context = context;
    // Initialize the WebView manager
    exports.globalState.webViewManager = new chat_view_1.WebViewManager(context);
    // Load configuration and initialize API clients
    (0, configuration_1.loadConfiguration)();
    // Register commands for chat interface
    (0, chat_manager_1.setupChatCommands)(context);
    // Register commands for code assistance
    (0, code_assistant_1.setupCodeAssistantCommands)(context);
    // Set up project analyzer
    (0, project_analyzer_1.setupProjectAnalyzer)(context);
}
function deactivate() {
    // Clean up resources
    if (exports.globalState.webViewManager) {
        exports.globalState.webViewManager.dispose();
    }
    console.log('Claude Coding Assistant has been deactivated');
}
//# sourceMappingURL=extension.js.map