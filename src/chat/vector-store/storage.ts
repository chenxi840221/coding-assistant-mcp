// src/chat/vector-store/storage.ts

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Interface for a vector store item
 */
export interface VectorItem {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
  content: string;
}

/**
 * Interface for a search result
 */
export interface SearchResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
  content: string;
}

/**
 * A simple vector storage implementation using the filesystem
 */
export class VectorStorage {
  private readonly indexPath: string;
  private readonly vectorsPath: string;
  private readonly contentPath: string;
  private items: Map<string, { vector: number[], metadata: Record<string, any> }> = new Map();

  constructor(basePath: string) {
    this.indexPath = path.join(basePath, 'index.json');
    this.vectorsPath = path.join(basePath, 'vectors');
    this.contentPath = path.join(basePath, 'content');
  }

  /**
   * Initialize the vector storage
   */
  public async initialize(): Promise<void> {
    // Create directories if they don't exist
    if (!fs.existsSync(this.vectorsPath)) {
      fs.mkdirSync(this.vectorsPath, { recursive: true });
    }
    
    if (!fs.existsSync(this.contentPath)) {
      fs.mkdirSync(this.contentPath, { recursive: true });
    }

    // Load index if it exists
    if (fs.existsSync(this.indexPath)) {
      try {
        const indexData = JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
        for (const [id, item] of Object.entries(indexData)) {
          if (typeof item === 'object' && item !== null) {
            // Try to load vector file
            const vectorPath = path.join(this.vectorsPath, `${id}.json`);
            if (fs.existsSync(vectorPath)) {
              const vector = JSON.parse(fs.readFileSync(vectorPath, 'utf8'));
              this.items.set(id, {
                vector,
                metadata: (item as any).metadata || {}
              });
            }
          }
        }
        console.log(`Loaded ${this.items.size} items from vector store`);
      } catch (error) {
        console.error('Error loading vector store index:', error);
        // Start with an empty index if there's an error
        this.items = new Map();
      }
    }
  }

  /**
   * Add an item to the vector store
   */
  public async addItem(item: VectorItem): Promise<void> {
    // Store the item in memory
    this.items.set(item.id, {
      vector: item.vector,
      metadata: item.metadata
    });

    // Save the vector to a file
    const vectorPath = path.join(this.vectorsPath, `${item.id}.json`);
    fs.writeFileSync(vectorPath, JSON.stringify(item.vector));

    // Save the content to a file
    const contentPath = path.join(this.contentPath, `${item.id}.txt`);
    fs.writeFileSync(contentPath, item.content);

    // Update the index
    await this.saveIndex();
  }

  /**
   * Get an item from the vector store
   */
  public async getItem(id: string): Promise<VectorItem | null> {
    const item = this.items.get(id);
    if (!item) {
      return null;
    }

    // Load the content
    const contentPath = path.join(this.contentPath, `${id}.txt`);
    if (!fs.existsSync(contentPath)) {
      return null;
    }

    const content = fs.readFileSync(contentPath, 'utf8');

    return {
      id,
      vector: item.vector,
      metadata: item.metadata,
      content
    };
  }

  /**
   * Remove an item from the vector store
   */
  public async removeItem(id: string): Promise<void> {
    // Remove from memory
    this.items.delete(id);

    // Remove vector file
    const vectorPath = path.join(this.vectorsPath, `${id}.json`);
    if (fs.existsSync(vectorPath)) {
      fs.unlinkSync(vectorPath);
    }

    // Remove content file
    const contentPath = path.join(this.contentPath, `${id}.txt`);
    if (fs.existsSync(contentPath)) {
      fs.unlinkSync(contentPath);
    }

    // Update the index
    await this.saveIndex();
  }

  /**
   * Search for similar vectors
   */
  public async search(queryVector: number[], limit: number = 5): Promise<SearchResult[]> {
    const results: Array<{ id: string; score: number }> = [];

    // Calculate similarity for each item
    for (const [id, item] of this.items.entries()) {
      const similarity = this.cosineSimilarity(queryVector, item.vector);
      results.push({ id, score: similarity });
    }

    // Sort by similarity (descending)
    results.sort((a, b) => b.score - a.score);

    // Get top results
    const topResults = results.slice(0, limit);

    // Load full item data for each result
    const fullResults: SearchResult[] = [];
    for (const result of topResults) {
      const item = await this.getItem(result.id);
      if (item) {
        fullResults.push({
          id: item.id,
          score: result.score,
          metadata: item.metadata,
          content: item.content
        });
      }
    }

    return fullResults;
  }

  /**
   * Clear all items from the vector store
   */
  public async clear(): Promise<void> {
    // Clear memory
    this.items.clear();

    // Clear files
    if (fs.existsSync(this.vectorsPath)) {
      const vectorFiles = fs.readdirSync(this.vectorsPath);
      for (const file of vectorFiles) {
        fs.unlinkSync(path.join(this.vectorsPath, file));
      }
    }

    if (fs.existsSync(this.contentPath)) {
      const contentFiles = fs.readdirSync(this.contentPath);
      for (const file of contentFiles) {
        fs.unlinkSync(path.join(this.contentPath, file));
      }
    }

    // Clear index
    if (fs.existsSync(this.indexPath)) {
      fs.unlinkSync(this.indexPath);
    }
  }

  /**
   * Save the index to disk
   */
  private async saveIndex(): Promise<void> {
    const index: Record<string, { metadata: Record<string, any> }> = {};
    
    for (const [id, item] of this.items.entries()) {
      index[id] = {
        metadata: item.metadata
      };
    }
    
    fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }
}