import * as vscode from 'vscode';
import { ChatMessage, ChatSession } from '../models/interfaces';
import { generateUniqueId } from '../utils/file-utils';
import { getAnthropicClient, getConfig, isClientConfigured } from '../config/settings';
import {
  addMessageToVectorStore,
  findSimilarMessages,
  deleteSessionMessages
} from './vector-store';

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
 * Handle a new chat message with vector store integration
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
  const userMessage: ChatMessage = {
    role: 'user',
    content: text
  };

  session.messages.push(userMessage);

  // Update UI to show the message
  onUpdate(session);

  try {
    // Add to vector store
    await addMessageToVectorStore(userMessage, sessionId);

    // Find similar messages for context
    const similarMessages = findSimilarMessages(text, sessionId, 3);

    // Get Claude client and config
    const anthropic = getAnthropicClient();
    const config = getConfig();

    if (!anthropic || !config) {
      throw new Error('Anthropic client not properly configured');
    }

    // Add context from similar messages
    let contextMessage = '';
    if (similarMessages.length > 0) {
      contextMessage = `
Previous relevant messages:
${similarMessages.map(entry => `- "${entry.text}"`).join('\n')}

`;
    }

    // Build messages array
    // Ensure strict typing for messages
    const messages = [
      // System message
      {
        role: 'system' as const,
        content: 'You are Claude, an AI assistant. Use the provided context from previous similar conversations when relevant.'
      },
      // Context message if we have similar messages
      ...(contextMessage ? [{
        role: 'user' as const,
        content: contextMessage
      }] : []),
      // All prior messages in the current session
      ...session.messages.map(msg => {
        let role: 'system' | 'user' | 'assistant';
        switch (msg.role) {
          case 'system':
            role = 'system';
            break;
          case 'assistant':
            role = 'assistant';
            break;
          default:
            role = 'user';
        }
        return {
          role,
          content: msg.content
        };
      })
    ];

    // Get response from Claude
    // In the handleChatMessage method
    const response = await anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      // Move the system message to a separate parameter
      system: 'You are Claude, an AI assistant. Use the provided context from previous similar conversations when relevant.',
      // Only include user and assistant messages in the messages array
      messages: session.messages
        .filter(msg => msg.role !== 'system') // Exclude system messages from the messages array
        .map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        }))
    });

    // Extract response text
    let responseText = '';
    if (response.content && response.content.length > 0) {
      for (const contentBlock of response.content) {
        if ('text' in contentBlock && contentBlock.text) {
          responseText += contentBlock.text;
        }
      }
    }

    // Add assistant message to history
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: responseText
    };

    session.messages.push(assistantMessage);

    // Add to vector store
    await addMessageToVectorStore(assistantMessage, sessionId);

    // Update UI with the response
    onUpdate(session);

    // Save the session
    await updateSession(session);

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
 * Clear a chat session (update to use vector store)
 */
export async function clearChatSession(sessionId: string): Promise<void> {
  const session = getChatSession(sessionId);

  // Keep only the system message
  session.messages = session.messages.filter(msg => msg.role === 'system');

  // Clear vector store for this session
  await deleteSessionMessages(sessionId);

  // Save the session
  await updateSession(session);
}

/**
 * Update and save a session
 */
export async function updateSession(session: ChatSession): Promise<void> {
  // Update in memory
  chatSessions.set(session.id, session);

  // In a real implementation, we would save this to disk or database
  // For simplicity in this example, we're just keeping it in memory
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  // Delete from memory
  chatSessions.delete(sessionId);

  // Clear vector store for this session
  await deleteSessionMessages(sessionId);
}