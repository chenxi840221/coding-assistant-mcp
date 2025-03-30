import * as crypto from 'crypto';

/**
 * Simple text embedding using tf-idf inspired approach
 * Note: In a production environment, you would use a proper embedding model
 */
export class SimpleEmbedding {
  private vocabulary: Map<string, number> = new Map();
  private documentFrequency: Map<string, number> = new Map();
  private documentCount: number = 0;
  
  /**
   * Embed text into a vector representation
   */
  public embed(text: string): number[] {
    const terms = this.tokenize(text);
    const termFrequencies = this.calculateTermFrequencies(terms);
    const vector: number[] = [];
    
    // Update document count and document frequencies
    this.documentCount++;
    for (const term of new Set(terms)) {
      const currentFreq = this.documentFrequency.get(term) || 0;
      this.documentFrequency.set(term, currentFreq + 1);
    }
    
    // Calculate TF-IDF for each term in our vocabulary
    for (const [term, index] of this.vocabulary.entries()) {
      const tf = termFrequencies.get(term) || 0;
      const df = this.documentFrequency.get(term) || 0;
      const idf = df > 0 ? Math.log(this.documentCount / df) : 0;
      
      // Expand vector if necessary
      while (vector.length <= index) {
        vector.push(0);
      }
      
      vector[index] = tf * idf;
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }
  
  /**
   * Tokenize text into terms
   */
  private tokenize(text: string): string[] {
    // Simple tokenization - split on non-alphanumeric characters
    const terms = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2); // Filter out short terms
    
    // Update vocabulary
    for (const term of terms) {
      if (!this.vocabulary.has(term)) {
        this.vocabulary.set(term, this.vocabulary.size);
      }
    }
    
    return terms;
  }
  
  /**
   * Calculate term frequencies for a list of terms
   */
  private calculateTermFrequencies(terms: string[]): Map<string, number> {
    const frequencies = new Map<string, number>();
    
    for (const term of terms) {
      const currentFreq = frequencies.get(term) || 0;
      frequencies.set(term, currentFreq + 1);
    }
    
    // Normalize frequencies
    const maxFreq = Math.max(...frequencies.values());
    if (maxFreq > 0) {
      for (const [term, freq] of frequencies.entries()) {
        frequencies.set(term, freq / maxFreq);
      }
    }
    
    return frequencies;
  }
  
  /**
   * Calculate cosine similarity between two vectors
   */
  public similarity(a: number[], b: number[]): number {
    const length = Math.max(a.length, b.length);
    let dotProduct = 0;
    
    for (let i = 0; i < length; i++) {
      dotProduct += (a[i] || 0) * (b[i] || 0);
    }
    
    return dotProduct;
  }
  
  /**
   * Save embedding state as JSON
   */
  public serialize(): string {
    return JSON.stringify({
      vocabulary: Array.from(this.vocabulary.entries()),
      documentFrequency: Array.from(this.documentFrequency.entries()),
      documentCount: this.documentCount
    });
  }
  
  /**
   * Load embedding state from JSON
   */
  public static deserialize(json: string): SimpleEmbedding {
    const data = JSON.parse(json);
    const embedding = new SimpleEmbedding();
    
    embedding.vocabulary = new Map(data.vocabulary);
    embedding.documentFrequency = new Map(data.documentFrequency);
    embedding.documentCount = data.documentCount;
    
    return embedding;
  }
}