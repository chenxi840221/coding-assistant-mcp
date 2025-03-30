import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SimpleEmbedding } from './embedding';

/**
 * Interface for a conversation entry in the vector store
 */
export interface VectorEntry {
  id: string;
  text: string;
  sessionId: string;
  timestamp: number;
  embedding: number[];
}

/**
 * Storage layer for vector data
 */
export class VectorStorage {
  private entries: VectorEntry[] = [];
  private embedding: SimpleEmbedding;
  private storagePath: string;
  
  constructor(storagePath: string) {
    this.storagePath = storagePath;
    this.embedding = new SimpleEmbedding();
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }
  }
  
  /**
   * Add an entry to the vector store
   */
  public async addEntry(id: string, text: string, sessionId: string): Promise<void> {
    const embedding = this.embedding.embed(text);
    
    const entry: VectorEntry = {
      id,
      text,
      sessionId,
      timestamp: Date.now(),
      embedding
    };
    
    this.entries.push(entry);
    
    // Save the entry to disk
    await this.saveEntry(entry);
  }
  
  /**
   * Save an entry to disk
   */
  private async saveEntry(entry: VectorEntry): Promise<void> {
    const entryPath = path.join(this.storagePath, `${entry.id}.json`);
    await fs.promises.writeFile(entryPath, JSON.stringify(entry), 'utf8');
  }
  
  /**
   * Load all entries from disk
   */
  public async loadEntries(): Promise<void> {
    // Clear existing entries
    this.entries = [];
    
    // Read all files in the storage directory
    const files = await fs.promises.readdir(this.storagePath);
    
    // Load each entry
    for (const file of files) {
      if (file.endsWith('.json') && file !== 'embedding.json') {
        try {
          const entryPath = path.join(this.storagePath, file);
          const entryData = await fs.promises.readFile(entryPath, 'utf8');
          const entry = JSON.parse(entryData) as VectorEntry;
          
          this.entries.push(entry);
        } catch (error) {
          console.error(`Error loading vector entry ${file}:`, error);
        }
      }
    }
    
    // Sort entries by timestamp
    this.entries.sort((a, b) => a.timestamp - b.timestamp);
    
    // Load embedding if it exists
    try {
      const embeddingPath = path.join(this.storagePath, 'embedding.json');
      if (fs.existsSync(embeddingPath)) {
        const embeddingData = await fs.promises.readFile(embeddingPath, 'utf8');
        this.embedding = SimpleEmbedding.deserialize(embeddingData);
      }
    } catch (error) {
      console.error('Error loading embedding:', error);
      // Continue with a new embedding
      this.embedding = new SimpleEmbedding();
    }
  }
  
  /**
   * Save embedding state to disk
   */
  public async saveEmbedding(): Promise<void> {
    const embeddingPath = path.join(this.storagePath, 'embedding.json');
    await fs.promises.writeFile(embeddingPath, this.embedding.serialize(), 'utf8');
  }
  
  /**
   * Find similar entries to a query
   */
  public findSimilar(query: string, sessionId?: string, limit: number = 5): VectorEntry[] {
    const queryEmbedding = this.embedding.embed(query);
    
    // Calculate similarity scores
    const scoredEntries = this.entries
      .filter(entry => !sessionId || entry.sessionId === sessionId)
      .map(entry => ({
        entry,
        score: this.embedding.similarity(queryEmbedding, entry.embedding)
      }))
      .sort((a, b) => b.score - a.score) // Sort by similarity (descending)
      .slice(0, limit); // Take top N
    
    return scoredEntries.map(item => item.entry);
  }
  
  /**
   * Get all entries for a specific session
   */
  public getSessionEntries(sessionId: string): VectorEntry[] {
    return this.entries
      .filter(entry => entry.sessionId === sessionId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Delete entries for a specific session
   */
  public async deleteSessionEntries(sessionId: string): Promise<void> {
    // Get entries for this session
    const sessionEntries = this.getSessionEntries(sessionId);
    
    // Remove from memory
    this.entries = this.entries.filter(entry => entry.sessionId !== sessionId);
    
    // Remove from disk
    for (const entry of sessionEntries) {
      const entryPath = path.join(this.storagePath, `${entry.id}.json`);
      try {
        await fs.promises.unlink(entryPath);
      } catch (error) {
        console.error(`Error deleting vector entry ${entry.id}:`, error);
      }
    }
  }
}