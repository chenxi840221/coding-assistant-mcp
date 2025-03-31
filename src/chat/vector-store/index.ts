// src/chat/vector-store/index.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EmbeddingService } from './embedding';
import { VectorStorage } from './storage';
import { globalState } from '../../models/interfaces';

// Vector store singleton instances
let embeddingService: EmbeddingService | undefined;
let vectorStorage: VectorStorage | undefined;
let isInitialized = false;

/**
 * Document type for vector store
 */
export interface CodeDocument {
  path: string;
  content: string;
  type: string;
  metadata?: Record<string, any>;
}

/**
 * Initialize the vector store
 */
export async function initializeVectorStore(context?: vscode.ExtensionContext): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    // Create vector store directory if it doesn't exist
    const storageDir = context 
      ? path.join(context.globalStoragePath, 'vector-store')
      : path.join((globalState as any).context?.globalStoragePath || os.tmpdir(), 'vector-store');
    
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    // Initialize embedding service
    embeddingService = new EmbeddingService();
    await embeddingService.initialize();

    // Initialize vector storage
    vectorStorage = new VectorStorage(storageDir);
    await vectorStorage.initialize();

    isInitialized = true;
    console.log('Vector store initialized successfully');
  } catch (error) {
    console.error('Failed to initialize vector store:', error);
    throw error;
  }
}

/**
 * Add a document to the vector store
 */
export async function addToVectorStore(document: CodeDocument): Promise<void> {
  if (!isInitialized || !embeddingService || !vectorStorage) {
    await initializeVectorStore();
  }

  try {
    // Generate embedding for the document
    const embedding = await embeddingService!.generateEmbedding(document.content);
    
    // Add to vector storage with document info
    await vectorStorage!.addItem({
      id: generateDocumentId(document.path),
      vector: embedding,
      metadata: {
        path: document.path,
        type: document.type,
        ...document.metadata
      },
      content: document.content
    });
  } catch (error) {
    console.error(`Failed to add document to vector store: ${document.path}`, error);
    throw error;
  }
}

/**
 * Search the vector store for similar code
 */
export async function searchVectorStore(query: string, limit: number = 5): Promise<Array<{document: CodeDocument, score: number}>> {
  if (!isInitialized || !embeddingService || !vectorStorage) {
    await initializeVectorStore();
  }

  try {
    // Generate embedding for the query
    const queryEmbedding = await embeddingService!.generateEmbedding(query);
    
    // Search for similar vectors
    const results = await vectorStorage!.search(queryEmbedding, limit);
    
    // Map results to documents
    return results.map(result => ({
      document: {
        path: result.metadata.path,
        content: result.content,
        type: result.metadata.type
      },
      score: result.score
    }));
  } catch (error) {
    console.error('Failed to search vector store:', error);
    throw error;
  }
}

/**
 * Clear the vector store
 */
export async function clearVectorStore(): Promise<void> {
  if (!isInitialized || !vectorStorage) {
    return;
  }

  try {
    await vectorStorage.clear();
    console.log('Vector store cleared successfully');
  } catch (error) {
    console.error('Failed to clear vector store:', error);
    throw error;
  }
}

/**
 * Generate a unique ID for a document
 */
function generateDocumentId(path: string): string {
  return `doc_${Buffer.from(path).toString('base64')}`;
}