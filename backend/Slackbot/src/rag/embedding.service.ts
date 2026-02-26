import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export class EmbeddingService {
  /**
   * Generate embeddings for text using Gemini text-embedding-004
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  static async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const results = await Promise.all(
        texts.map(text => model.embedContent(text))
      );
      return results.map(r => r.embedding.values);
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
