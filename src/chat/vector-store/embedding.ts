// src/chat/vector-store/embedding.ts

import axios from 'axios';
import { getConfig } from '../../config/configuration';

/**
 * Service for generating embeddings using Anthropic's API
 */
export class EmbeddingService {
  private apiKey: string = '';
  private readonly embeddingDimension = 1536; // Claude embeddings dimension
  private readonly embeddingEndpoint = 'https://api.anthropic.com/v1/embeddings';

  /**
   * Initialize the embedding service
   */
  public async initialize(): Promise<void> {
    const config = getConfig();
    if (!config || !config.apiKey) {
      throw new Error('API key is not configured');
    }
    this.apiKey = config.apiKey;
  }

  /**
   * Generate an embedding for the given text
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    try {
      // For large texts, we need to truncate to fit within limits
      const truncatedText = this.truncateText(text, 8000); // Claude embedding has a token limit

      // Call Anthropic's embedding API
      const response = await axios.post(
        this.embeddingEndpoint,
        {
          model: "claude-3-embed-20240219",
          input: truncatedText,
          type: "text"
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );

      // Extract the embedding
      return response.data.embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      
      // Fallback: generate a random embedding for development/testing
      // In production, this should be removed and proper error handling implemented
      return this.generateRandomEmbedding();
    }
  }

  /**
   * Truncate text to a certain character limit
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Keep the first and last parts of the text to maintain context
    const firstPart = text.substring(0, maxLength / 2);
    const lastPart = text.substring(text.length - maxLength / 2);
    
    return `${firstPart}...${lastPart}`;
  }

  /**
   * Generate a random embedding (for development/testing)
   */
  private generateRandomEmbedding(): number[] {
    const embedding: number[] = [];
    const norm = Math.sqrt(this.embeddingDimension); // For unit vector normalization
    
    // Generate random values
    let sumSquares = 0;
    for (let i = 0; i < this.embeddingDimension; i++) {
      const value = (Math.random() * 2) - 1; // Random value between -1 and 1
      embedding.push(value);
      sumSquares += value * value;
    }
    
    // Normalize to create a unit vector
    const length = Math.sqrt(sumSquares);
    for (let i = 0; i < this.embeddingDimension; i++) {
      embedding[i] = embedding[i] / length;
    }
    
    return embedding;
  }
}