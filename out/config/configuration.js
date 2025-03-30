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
exports.loadConfiguration = loadConfiguration;
exports.registerConfigListeners = registerConfigListeners;
exports.isClientConfigured = isClientConfigured;
exports.getAnthropicClient = getAnthropicClient;
exports.getConfig = getConfig;
// Configuration management
const vscode = __importStar(require("vscode"));
const sdk_1 = require("@anthropic-ai/sdk");
const interfaces_1 = require("../models/interfaces");
/**
 * Loads the extension configuration from VS Code settings
 */
function loadConfiguration() {
    const claudeConfig = vscode.workspace.getConfiguration('claudeAssistant');
    const config = {
        apiKey: claudeConfig.get('apiKey') || '',
        model: claudeConfig.get('model') || 'claude-3-7-sonnet-20250219',
        maxContextSize: claudeConfig.get('maxContextSize') || 100000,
        maxTokens: claudeConfig.get('maxTokens') || 4000
    };
    // Store in global state
    interfaces_1.globalState.config = config;
    // Initialize or update Anthropic client
    if (config.apiKey) {
        interfaces_1.globalState.anthropic = new sdk_1.Anthropic({ apiKey: config.apiKey });
    }
    else {
        vscode.window.showErrorMessage('Claude API key is not set. Please configure it in settings.');
    }
}
/**
 * Register listeners for configuration changes
 */
function registerConfigListeners(context) {
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('claudeAssistant')) {
            loadConfiguration();
        }
    }));
}
/**
 * Check if the client is properly configured
 */
function isClientConfigured() {
    return !!interfaces_1.globalState.anthropic && !!interfaces_1.globalState.config?.apiKey;
}
/**
 * Get the configured Anthropic client
 */
function getAnthropicClient() {
    return interfaces_1.globalState.anthropic;
}
/**
 * Get the current configuration
 */
function getConfig() {
    return interfaces_1.globalState.config;
}
//# sourceMappingURL=configuration.js.map