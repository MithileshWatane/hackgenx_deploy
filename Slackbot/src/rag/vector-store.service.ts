import { Pinecone } from '@pinecone-database/pinecone';
import { logger } from '../utils/logger';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// Pinecone index name - set via env or default
const INDEX_NAME = process.env.PINECONE_INDEX || 'doctor-ai-memory';

export class VectorStore {
  private index: ReturnType<typeof pinecone.index>;

  constructor() {
    this.index = pinecone.index(INDEX_NAME);
  }

  /**
   * Initialize the vector store (no-op for Pinecone — index is managed in dashboard)
   */
  async initialize(): Promise<void> {
    try {
      const stats = await this.index.describeIndexStats();
      logger.info('Pinecone index connected', {
        totalVectorCount: stats.totalRecordCount,
      });
    } catch (error) {
      logger.error('Failed to connect to Pinecone index:', error);
      throw error;
    }
  }

  /**
   * Add embeddings to Pinecone
   */
  async addEmbeddings(params: {
    ids: string[];
    embeddings: number[][];
    documents: string[];
    metadatas?: Record<string, any>[];
  }): Promise<void> {
    try {
      const vectors = params.ids.map((id, i) => ({
        id,
        values: params.embeddings[i],
        metadata: {
          document: params.documents[i],
          ...(params.metadatas?.[i] || {}),
        },
      }));

      await this.index.upsert(vectors);
      logger.info(`Upserted ${vectors.length} vectors to Pinecone`);
    } catch (error) {
      logger.error('Failed to add embeddings to Pinecone:', error);
      throw error;
    }
  }

  /**
   * Query similar embeddings from Pinecone
   */
  async querySimilar(params: {
    queryEmbedding: number[];
    nResults?: number;
    where?: Record<string, any>;
  }): Promise<{
    ids: string[][];
    distances: number[][];
    documents: string[][];
    metadatas: Record<string, any>[][];
  }> {
    try {
      const queryParams: any = {
        vector: params.queryEmbedding,
        topK: params.nResults || 5,
        includeMetadata: true,
      };

      // Pinecone metadata filter (same key-value shape as Chroma's where)
      if (params.where && Object.keys(params.where).length > 0) {
        queryParams.filter = params.where;
      }

      const response = await this.index.query(queryParams);
      const matches = response.matches || [];

      // Map back to the same shape the RAGEngine expects
      const ids: string[][] = [matches.map(m => m.id)];
      // Pinecone returns score (cosine similarity 0-1), convert to distance
      const distances: number[][] = [matches.map(m => 1 - (m.score ?? 0))];
      const documents: string[][] = [matches.map(m => (m.metadata?.document as string) || '')];
      const metadatas: Record<string, any>[][] = [
        matches.map(m => {
          const { document: _doc, ...rest } = (m.metadata as Record<string, any>) || {};
          return rest;
        }),
      ];

      return { ids, distances, documents, metadatas };
    } catch (error) {
      logger.error('Failed to query Pinecone:', error);
      throw error;
    }
  }

  /**
   * Delete embeddings by IDs from Pinecone
   */
  async deleteEmbeddings(ids: string[]): Promise<void> {
    try {
      await this.index.deleteMany(ids);
      logger.info(`Deleted ${ids.length} vectors from Pinecone`);
    } catch (error) {
      logger.error('Failed to delete embeddings from Pinecone:', error);
      throw error;
    }
  }
}
