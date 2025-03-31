// src/chat/vector-store/index.ts

import * as vscode from 'vscode';
import { VectorDocument } from '../../models/interfaces';

// In-memory vector store (in a real implementation, this would use embeddings)
let documents: VectorDocument[] = [];
let initialized = false;

/**
 * Initialize the vector store
 */
export async function initializeVectorStore(context: vscode.ExtensionContext): Promise<void> {
  if (initialized) {
    return;
  }
  
  // In a real implementation, this would load previously stored embeddings
  // For now, just set the initialized flag
  initialized = true;
  console.log('Vector store initialized');
}

/**
 * Add a document to the vector store
 */
export async function addDocument(document: VectorDocument): Promise<void> {
  // In a real implementation, this would compute embeddings
  documents.push({
    ...document,
    id: document.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  });
}

/**
 * Find documents relevant to a query
 */
export async function findRelevantContext(query: string): Promise<VectorDocument[]> {
  // In a real implementation, this would perform semantic search using embeddings
  // For now, just do a simple keyword search
  
  // If we have no documents, return empty array
  if (documents.length === 0) {
    return [];
  }

  // Split query into keywords
  const keywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 3);
  
  // Simple scoring function
  const scoredDocs = documents.map(doc => {
    const content = doc.content.toLowerCase();
    let score = 0;
    
    for (const keyword of keywords) {
      if (content.includes(keyword)) {
        score += 1;
      }
    }
    
    return { doc, score };
  });
  
  // Sort by score and take top 3
  return scoredDocs
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.doc);
}

/**
 * Remove a document from the vector store
 */
export async function removeDocument(documentId: string): Promise<boolean> {
  const initialLength = documents.length;
  documents = documents.filter(doc => doc.id !== documentId);
  return documents.length < initialLength;
}

/**
 * Clear all documents from the vector store
 */
export async function clearVectorStore(): Promise<void> {
  documents = [];
}