import * as vscode from 'vscode';
import { Anthropic } from '@anthropic-ai/sdk';
import { 
  ChatMessage, 
  ChatSession, 
  ChatSessionMetadata, 
  Config, 
  globalState 
} from '../models/interfaces';
import { generateUniqueId } from '../utils/file-utils';
import { 
  getAnthropicClient, 
  getConfig, 
  isClientConfigured, 
  loadConfiguration, 
  registerConfigListeners 
} from '../config/configuration';
import { WebViewManager } from './chat-view';
import { EnhancedChatViewManager } from './enhanced-chat-view';
import { initializeVectorStore } from './vector-store';
import { getCodeFileManager } from '../utils/code-file-manager';
import { setupProjectAnalyzer } from '../code-assistant/project-analyzer';
import { 
  extensionManagers, 
  registerEditorContextTracking, 
  registerGitHubCommands
} from '../utils/extension-utils';
import { askClaudeMCP, generateCode } from '../code-assistant/code-assistant';

// Chat sessions storage
export const chatSessions: Map<string, ChatSession> = new Map();

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  MAX_TOKENS_PER_MINUTE: 50000,  // Anthropic's typical rate limit
  MIN_DELAY_BETWEEN_REQUESTS: 1000, // 1 second minimum delay
  MAX_DELAY_BETWEEN_REQUESTS: 5000  // 5 seconds maximum delay
};

/**
 * Sets the WebView manager for chat functionality
 */
export function setWebViewManager(manager: WebViewManager): void {
  console.log('Setting WebView manager in chat-manager');
  extensionManagers.webViewManager = manager;
}

/**
 * Create a new chat session
 */
export function createChatSession(name: string = 'General Chat'): ChatSession {
  const sessionId = generateUniqueId();
  console.log(`Creating new chat session: ${sessionId}`);
  
  const newSession: ChatSession = {
    id: sessionId,
    name: name,
    messages: [
      {
        role: 'system',
        content: 'You are Claude, an AI assistant by Anthropic. You are helpful, honest, and harmless.'
      }
    ],
    // Add metadata to track rate limiting
    metadata: {
      tokensUsed: 0,
      lastRequestTimestamp: 0
    }
  };
  
  chatSessions.set(sessionId, newSession);
  return newSession;
}

/**
 * Get a chat session by ID or create a new one
 */
export function getChatSession(sessionId?: string): ChatSession {
  console.log(`Getting chat session: ${sessionId || 'new session'}`);
  if (sessionId && chatSessions.has(sessionId)) {
    console.log(`Found existing session: ${sessionId}`);
    return chatSessions.get(sessionId)!;
  }
  
  console.log('Creating new session');
  return createChatSession();
}

/**
 * Delay function with jitter to prevent synchronization
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => 
    setTimeout(resolve, ms + Math.random() * 500)
  );
}

/**
 * Calculate dynamic delay based on token usage and previous request time
 */
function calculateDelay(session: ChatSession): number {
  // Ensure metadata exists
  if (!session.metadata) {
    session.metadata = { 
      tokensUsed: 0, 
      lastRequestTimestamp: 0 
    };
  }

  const metadata = session.metadata;
  const now = Date.now();
  const timeSinceLastRequest = now - metadata.lastRequestTimestamp;
  
  // Exponential backoff if rate limit is approached
  if (metadata.tokensUsed > RATE_LIMIT_CONFIG.MAX_TOKENS_PER_MINUTE * 0.8) {
    const baseDelay = Math.min(
      RATE_LIMIT_CONFIG.MAX_DELAY_BETWEEN_REQUESTS,
      Math.max(
        RATE_LIMIT_CONFIG.MIN_DELAY_BETWEEN_REQUESTS,
        timeSinceLastRequest
      )
    );
    
    // Exponential backoff with jitter
    return baseDelay * Math.pow(2, Math.floor(metadata.tokensUsed / RATE_LIMIT_CONFIG.MAX_TOKENS_PER_MINUTE));
  }
  
  // Minimum delay to prevent overwhelming the API
  return Math.max(
    RATE_LIMIT_CONFIG.MIN_DELAY_BETWEEN_REQUESTS, 
    RATE_LIMIT_CONFIG.MIN_DELAY_BETWEEN_REQUESTS - timeSinceLastRequest
  );
}

/**
 * Handle a new chat message with advanced rate limiting
 */
export async function handleChatMessage(
  sessionId: string, 
  text: string, 
  onUpdate: (session: ChatSession) => void
): Promise<void> {
  console.log(`Handling chat message for session ${sessionId}: ${text.substring(0, 30)}...`);
  
  // Check if the client is configured
  if (!isClientConfigured()) {
    console.error('Claude API key is not configured');
    vscode.window.showErrorMessage('Claude API key is not configured');
    return;
  }
  
  const session = getChatSession(sessionId);
  
  // Ensure metadata exists
  if (!session.metadata) {
    session.metadata = {
      tokensUsed: 0,
      lastRequestTimestamp: 0
    };
  }
  
  // Add user message to history
  session.messages.push({
    role: 'user',
    content: text
  });
  
  // Update UI to show the message
  console.log('Updating UI with user message');
  onUpdate(session);
  
  try {
    // Get Claude client and config
    const anthropic = getAnthropicClient();
    const config = getConfig();
    
    if (!anthropic || !config) {
      throw new Error('Anthropic client not properly configured');
    }
    
    // Apply rate limiting delay
    const delayTime = calculateDelay(session);
    console.log(`Applying delay of ${delayTime}ms to prevent rate limiting`);
    await delay(delayTime);
    
    console.log('Sending request to Claude API');
    
    // Function to accumulate and send messages with rate control
    const processResponseParts = async (initialMessages: ChatMessage[]) => {
      let accumulatedResponse = '';
      let isFirstResponse = true;
      let totalTokensProcessed = 0;

      const processResponse = async (messageHistory: ChatMessage[]): Promise<void> => {
        try {
          // Limit message history to prevent excessive context
          const limitedHistory = messageHistory.slice(-10);
          
          const response = await anthropic.messages.create({
            model: config.model,
            max_tokens: config.maxTokens,
            messages: limitedHistory.map(msg => ({
              role: msg.role === 'system' ? 'user' : msg.role,
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
          
          // Update tokens used
          const currentTokens = response.usage?.input_tokens || 0;
          totalTokensProcessed += currentTokens;
          
          // For the first response, start fresh
          if (isFirstResponse) {
            accumulatedResponse = responseText;
            isFirstResponse = false;
          } else {
            // For subsequent responses, append to accumulated response
            accumulatedResponse += responseText;
          }
          
          // Update session metadata
          if (session.metadata) {
            session.metadata.tokensUsed = totalTokensProcessed;
            session.metadata.lastRequestTimestamp = Date.now();
          }
          
          // Update session with current accumulated response
          session.messages = session.messages.filter(m => 
            m.role !== 'assistant' || m.content !== accumulatedResponse
          );
          session.messages.push({
            role: 'assistant',
            content: accumulatedResponse
          });
          
          // Update UI
          onUpdate(session);
          
          // Check if more tokens are needed
          const maxTokenThreshold = config.maxTokens * 0.9; // 90% of max tokens
          const isResponseTruncated = response.stop_reason === 'max_tokens';
          
          if (isResponseTruncated) {
            // Apply additional delay for continuation
            await delay(calculateDelay(session));
            
            // Prepare for next request by adding the current response to history
            const continueRequest: ChatMessage[] = [
              ...limitedHistory,
              { 
                role: 'assistant', 
                content: accumulatedResponse 
              },
              {
                role: 'user',
                content: 'Please continue your previous response from where you left off.'
              }
            ];
            
            await processResponse(continueRequest);
          }
        } catch (error) {
          console.error('Error in chat processing:', error);
          
          // Check for rate limit errors
          if (error instanceof Error && error.message.includes('rate limit')) {
            // Exponential backoff for rate limit errors
            const backoffDelay = Math.min(
              RATE_LIMIT_CONFIG.MAX_DELAY_BETWEEN_REQUESTS,
              RATE_LIMIT_CONFIG.MIN_DELAY_BETWEEN_REQUESTS * Math.pow(2, 3)
            );
            
            console.log(`Rate limit hit. Backing off for ${backoffDelay}ms`);
            await delay(backoffDelay);
            
            // Retry the request
            return processResponse(session.messages);
          }
          
          session.messages.push({
            role: 'assistant',
            content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : String(error)}`
          });
          onUpdate(session);
        }
      };

      // Start the initial response generation
      await processResponse(initialMessages);
    };

    // Start processing the conversation
    await processResponseParts(session.messages);
    
  } catch (error) {
    console.error('Error getting response from Claude:', error);
    
    // Add error message
    session.messages.push({
      role: 'assistant',
      content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : String(error)}`
    });
    
    // Update UI to show the error
    console.log('Updating UI with error message');
    onUpdate(session);
  }
}

/**
 * Set up chat commands
 */
export function setupChatCommands(context: vscode.ExtensionContext) {
  console.log('Setting up chat commands');
  const openChatViewCommand = vscode.commands.registerCommand(
    'claudeAssistant.openChatView', 
    () => {
      console.log('openChatView command triggered');
      const webViewManager = extensionManagers.webViewManager;
      if (webViewManager) {
        webViewManager.openChatView();
      } else {
        console.error('WebView manager not available!');
        vscode.window.showErrorMessage('WebView manager is not available. Please try reloading the window.');
      }
    }
  );
  
  context.subscriptions.push(openChatViewCommand);
  console.log('Chat commands registered');
}

/**
 * Activate the chat functionality
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('===============================================');
  console.log('Claude Coding Assistant - DETAILED ACTIVATION');
  console.log('===============================================');
  console.log(`Extension activation timestamp: ${new Date().toISOString()}`);
  
  try {
    // Store extension context in global state
    globalState.context = context;
    
    // Initialize WebView Managers
    console.log('1. Initializing WebView Managers');
    const webViewManager = new WebViewManager(context);
    const enhancedChatViewManager = new EnhancedChatViewManager(context);
    
    // Store managers in centralized location
    extensionManagers.webViewManager = webViewManager;
    extensionManagers.enhancedChatViewManager = enhancedChatViewManager;
    
    // Share the WebView manager
    setWebViewManager(webViewManager);

    // Load configuration
    console.log('2. Loading Configuration');
    loadConfiguration();
    
    // Register config change listeners
    console.log('3. Registering Config Listeners');
    registerConfigListeners(context);

    // Initialize vector store
    console.log('4. Initializing Vector Store');
    initializeVectorStore(context).catch(error => {
      console.error('Failed to initialize vector store:', error);
    });

    // Initialize code file manager
    console.log('5. Initializing Code File Manager');
    getCodeFileManager();

    // Setup chat commands
    console.log('6. Setting Up Chat Commands');
    setupChatCommands(context);
    
    // Setup other commands and integrations
    console.log('7. Setting Up Additional Commands');
    setupAdditionalCommands(context);

    // Setup project analyzer
    console.log('8. Setting Up Project Analyzer');
    setupProjectAnalyzer(context);
    
    // Register GitHub commands
    console.log('9. Registering GitHub Commands');
    registerGitHubCommands(context);
    
    // Register editor context tracking
    console.log('10. Registering Editor Context Tracking');
    registerEditorContextTracking(context);
    
    console.log('===============================================');
    console.log('Claude Coding Assistant - ACTIVATION COMPLETE');
    console.log('===============================================');
  } catch (error) {
    console.error('CRITICAL ACTIVATION ERROR:', error);
    vscode.window.showErrorMessage(`Claude Coding Assistant failed to activate: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Additional helper function to setup other commands
 */
function setupAdditionalCommands(context: vscode.ExtensionContext) {
  // Direct chat command
  const openChatViewDirectCommand = vscode.commands.registerCommand(
    'claudeAssistant.openChatViewDirect', 
    () => {
      console.log('Direct chat command triggered');
      const webViewManager = extensionManagers.webViewManager;
      if (webViewManager) {
        webViewManager.openChatView();
      } else {
        console.error('WebView manager not initialized!');
        vscode.window.showErrorMessage('WebView manager not initialized. Try reloading the window.');
      }
    }
  );
  
  // Enhanced chat command
  const openEnhancedChatCommand = vscode.commands.registerCommand(
    'claudeAssistant.openEnhancedChat',
    () => {
      console.log('Enhanced chat command triggered');
      const enhancedChatViewManager = extensionManagers.enhancedChatViewManager;
      if (enhancedChatViewManager) {
        enhancedChatViewManager.openChatView();
      } else {
        console.error('Enhanced chat view manager not initialized!');
        vscode.window.showErrorMessage('Enhanced chat view manager not initialized. Try reloading the window.');
      }
    }
  );
  
  // Unified code assistant command
  const unifiedCodeAssistantCommand = vscode.commands.registerCommand(
    'claudeAssistant.unifiedCodeAssistant',
    () => {
      console.log('Unified code assistant command triggered');
      const enhancedChatViewManager = extensionManagers.enhancedChatViewManager;
      if (enhancedChatViewManager) {
        enhancedChatViewManager.openChatView();
      } else {
        console.error('Enhanced chat view manager not initialized!');
        vscode.window.showErrorMessage('Enhanced chat view manager not initialized. Try reloading the window.');
      }
    }
  );
  
  // Register commands in context
  context.subscriptions.push(
    openChatViewDirectCommand,
    openEnhancedChatCommand,
    unifiedCodeAssistantCommand
  );
}

/**
 * Clear a chat session
 */
export function clearChatSession(sessionId: string): void {
  console.log(`Clearing chat session: ${sessionId}`);
  const session = getChatSession(sessionId);
  
  // Keep only the system message and reset metadata
  session.messages = session.messages.filter(msg => msg.role === 'system');
  session.metadata = {
    tokensUsed: 0,
    lastRequestTimestamp: 0
  };
}

/**
 * Delete a chat session
 */
export function deleteChatSession(sessionId: string): boolean {
  console.log(`Deleting chat session: ${sessionId}`);
  return chatSessions.delete(sessionId);
}

/**
 * Deactivate the chat functionality
 */
export function deactivate() {
  console.log('Deactivating Claude Coding Assistant Chat Manager');
  
  // Clear chat sessions
  chatSessions.clear();
  
  // Reset extension managers
  if (extensionManagers.webViewManager) {
    extensionManagers.webViewManager.dispose();
    extensionManagers.webViewManager = undefined;
  }
  
  if (extensionManagers.enhancedChatViewManager) {
    extensionManagers.enhancedChatViewManager.dispose();
    extensionManagers.enhancedChatViewManager = undefined;
  }
}