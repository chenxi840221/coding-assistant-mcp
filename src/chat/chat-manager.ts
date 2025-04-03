import * as vscode from 'vscode';
import { ChatMessage, ChatSession } from '../models/interfaces';
import { generateUniqueId } from '../utils/file-utils';
import { getAnthropicClient, getConfig, isClientConfigured } from '../config/configuration';

// Chat sessions storage
export const chatSessions: Map<string, ChatSession> = new Map();

// WebView manager reference - will be set by the extension.ts
let webViewManager: any;

export function setWebViewManager(manager: any) {
  console.log('Setting WebView manager in chat-manager');
  webViewManager = manager;
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
  console.log(`Getting chat session: ${sessionId || 'new session'}`);
  if (sessionId && chatSessions.has(sessionId)) {
    console.log(`Found existing session: ${sessionId}`);
    return chatSessions.get(sessionId)!;
  }
  
  console.log('Creating new session');
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
  console.log(`Handling chat message for session ${sessionId}: ${text.substring(0, 30)}...`);
  
  // Check if the client is configured
  if (!isClientConfigured()) {
    console.error('Claude API key is not configured');
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
  console.log('Updating UI with user message');
  onUpdate(session);
  
  try {
    // Get Claude client and config
    const anthropic = getAnthropicClient();
    const config = getConfig();
    
    if (!anthropic || !config) {
      throw new Error('Anthropic client not properly configured');
    }
    
    console.log('Sending request to Claude API');
    // Get response from Claude
    const response = await anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      messages: session.messages.map(msg => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.content
      }))
    });
    
    console.log('Received response from Claude API');
    
    // Extract response text
    let responseText = '';
    if (response.content && response.content.length > 0) {
      for (const contentBlock of response.content) {
        if ('text' in contentBlock) {
          responseText += contentBlock.text;
        }
      }
    }
    
    console.log(`Claude response text length: ${responseText.length}`);
    
    // Add assistant message to history
    session.messages.push({
      role: 'assistant',
      content: responseText
    });
    
    // Update UI with the response
    console.log('Updating UI with Claude response');
    onUpdate(session);
    
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
 * Clear a chat session
 */
export function clearChatSession(sessionId: string): void {
  console.log(`Clearing chat session: ${sessionId}`);
  const session = getChatSession(sessionId);
  
  // Keep only the system message
  session.messages = session.messages.filter(msg => msg.role === 'system');
}

/**
 * Delete a chat session
 */
export function deleteChatSession(sessionId: string): boolean {
  console.log(`Deleting chat session: ${sessionId}`);
  return chatSessions.delete(sessionId);
}