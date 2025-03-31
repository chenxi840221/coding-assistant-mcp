import * as vscode from 'vscode';
import { ChatMessage, ChatSession } from '../models/interfaces';
import { generateUniqueId } from '../utils/file-utils';
import { getAnthropicClient, getConfig, isClientConfigured } from '../config/configuration';

// Chat sessions storage
export const chatSessions: Map<string, ChatSession> = new Map();

// WebView manager reference - will be set by the extension.ts
let webViewManager: any;

export function setWebViewManager(manager: any) {
  webViewManager = manager;
}

/**
 * Set up chat commands
 */
export function setupChatCommands(context: vscode.ExtensionContext) {
  const openChatViewCommand = vscode.commands.registerCommand(
    'claudeAssistant.openChatView', 
    () => {
      if (webViewManager) {
        webViewManager.openChatView();
      }
    }
  );
  
  context.subscriptions.push(openChatViewCommand);
}

/**
 * Create a new chat session
 */
export function createChatSession(name: string = 'General Chat'): ChatSession {
  const sessionId = generateUniqueId();
  
  const newSession: ChatSession = {
    id: sessionId,
    name: name,
    messages: [
      {
        role: 'system',
        content: 'You are Claude, an AI assistant by Anthropic. You are helpful, harmless, and honest.'
      }
    ]
  };
  
  chatSessions.set(sessionId, newSession);
  return newSession;
}

/**
 * Get a chat session by ID or create a new one
 */
export function getChatSession(sessionId?: string): ChatSession {
  if (sessionId && chatSessions.has(sessionId)) {
    return chatSessions.get(sessionId)!;
  }
  
  return createChatSession();
}

/**
 * Handle a new chat message
 */
export async function handleChatMessage(
  sessionId: string, 
  text: string, 
  onUpdate: (session: ChatSession) => void
): Promise<void> {
  // Check if the client is configured
  if (!isClientConfigured()) {
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
    const anthropic = getAnthropicClient();
    const config = getConfig();
    
    if (!anthropic || !config) {
      throw new Error('Anthropic client not properly configured');
    }
    
    // Get response from Claude
    const response = await anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      messages: session.messages.map((msg: ChatMessage) => ({
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
    
    // Add assistant message to history
    session.messages.push({
      role: 'assistant',
      content: responseText
    });
    
    // Update UI with the response
    onUpdate(session);
    
  } catch (error) {
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
export function clearChatSession(sessionId: string): void {
  const session = getChatSession(sessionId);
  
  // Keep only the system message
  session.messages = session.messages.filter((msg: ChatMessage) => msg.role === 'system');
}

/**
 * Delete a chat session
 */
export function deleteChatSession(sessionId: string): boolean {
  return chatSessions.delete(sessionId);
}