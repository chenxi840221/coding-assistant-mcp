import * as path from 'path';
import * as vscode from 'vscode';
import { VectorStorage, VectorEntry } from './storage';
import { ChatMessage } from '../../models/interfaces';
import { generateUniqueId } from '../../utils/file-utils';

let vectorStorage: VectorStorage | undefined;

/**
 * Initialize the vector store
 */
export async function initializeVectorStore(context: vscode.ExtensionContext): Promise<void> {
  // Get storage path from extension context
  const storagePath = path.join(context.globalStoragePath, 'vector-store');
  
  // Create and initialize storage
  vectorStorage = new VectorStorage(storagePath);
  await vectorStorage.loadEntries();
}

/**
 * Add a message to the vector store
 */
export async function addMessageToVectorStore(
  message: ChatMessage,
  sessionId: string
): Promise<void> {
  if (!vectorStorage) {
    throw new Error('Vector store not initialized');
  }
  
  await vectorStorage.addEntry(
    generateUniqueId(),
    message.content,
    sessionId
  );
  
  // Save embedding state periodically
  await vectorStorage.saveEmbedding();
}

/**
 * Find similar messages to a query
 */
export function findSimilarMessages(
  query: string,
  sessionId?: string,
  limit: number = 5
): VectorEntry[] {
  if (!vectorStorage) {
    throw new Error('Vector store not initialized');
  }
  
  return vectorStorage.findSimilar(query, sessionId, limit);
}

/**
 * Delete all messages for a session
 */
export async function deleteSessionMessages(sessionId: string): Promise<void> {
  if (!vectorStorage) {
    throw new Error('Vector store not initialized');
  }
  
  await vectorStorage.deleteSessionEntries(sessionId);
  
  // Save updated embedding state
  await vectorStorage.saveEmbedding();
}

/**
 * Get conversation history for a session
 */
export function getSessionHistory(sessionId: string): VectorEntry[] {
  if (!vectorStorage) {
    throw new Error('Vector store not initialized');
  }
  
  return vectorStorage.getSessionEntries(sessionId);
}