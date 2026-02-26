import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export class EmbeddingService {
  // Pinecone free tier supports max 1024 dimensions
  private static readonly OUTPUT_DIMENSIONS = 1024;

  /**
   * Generate embeddings for text using Gemini models/gemini-embedding-001
   * Truncates to 1024 dimensions for Pinecone free tier compatibility
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = genAI.getGenerativeModel({ model: 'models/gemini-embedding-001' });
      const result = await model.embedContent(text);
      // Truncate to match Pinecone index dimensions
      return result.embedding.values.slice(0, this.OUTPUT_DIMENSIONS);
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * Truncates to 1024 dimensions for Pinecone free tier compatibility
   */
  static async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const model = genAI.getGenerativeModel({ model: 'models/gemini-embedding-001' });
      const results = await Promise.all(
        texts.map(text => model.embedContent(text))
      );
      // Truncate each embedding to match Pinecone index dimensions
      return results.map(r => r.embedding.values.slice(0, this.OUTPUT_DIMENSIONS));
    } catch (error) {
      logger.error('Failed to generate embeddings:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
