import { EmbeddingService } from './embedding.service';
import { VectorStore } from './vector-store.service';
import { prisma } from '../database/prisma.service';
import { RAGContext, MemoryResult } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class RAGEngine {
  private vectorStore: VectorStore;

  constructor() {
    this.vectorStore = new VectorStore();
  }

  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    logger.info('RAG Engine initialized');
  }

  /**
   * Store a memory with its embedding
   */
  async storeMemory(params: {
    content: string;
    source: string;
    sourceId?: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    try {
      // Generate embedding
      const embedding = await EmbeddingService.generateEmbedding(params.content);

      // Store in database
      const memory = await prisma.memoryEmbedding.create({
        data: {
          content: params.content,
          embedding: JSON.stringify(embedding),
          source: params.source,
          sourceId: params.sourceId,
          metadata: params.metadata,
        },
      });

      // Store in vector store
      await this.vectorStore.addEmbeddings({
        ids: [memory.id],
        embeddings: [embedding],
        documents: [params.content],
        metadatas: [{
          source: params.source,
          sourceId: params.sourceId,
          ...params.metadata,
        }],
      });

      logger.info('Memory stored', { memoryId: memory.id, source: params.source });
      return memory.id;
    } catch (error) {
      logger.error('Failed to store memory:', error);
      throw error;
    }
  }

  /**
   * Retrieve relevant memories using semantic search
   */
  async retrieveMemories(params: {
    query: string;
    limit?: number;
    source?: string;
    sourceId?: string;
    minSimilarity?: number;
  }): Promise<MemoryResult[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await EmbeddingService.generateEmbedding(params.query);

      // Build where clause for filtering
      const where: Record<string, any> = {};
      if (params.source) {
        where.source = params.source;
      }
      if (params.sourceId) {
        where.sourceId = params.sourceId;
      }

      // Query vector store
      const results = await this.vectorStore.querySimilar({
        queryEmbedding,
        nResults: params.limit || 5,
        where: Object.keys(where).length > 0 ? where : undefined,
      });

      // Convert distances to similarity scores (cosine distance to similarity)
      const memories: MemoryResult[] = [];
      
      for (let i = 0; i < results.ids[0].length; i++) {
        const similarity = 1 - (results.distances[0][i] || 0);
        
        // Filter by minimum similarity threshold
        if (params.minSimilarity && similarity < params.minSimilarity) {
          continue;
        }

        memories.push({
          id: results.ids[0][i],
          content: results.documents[0][i],
          similarity,
          source: results.metadatas[0][i]?.source || 'unknown',
          sourceId: results.metadatas[0][i]?.sourceId,
          metadata: results.metadatas[0][i],
        });
      }

      logger.info('Retrieved memories', { 
        query: params.query.substring(0, 50),
        count: memories.length 
      });

      return memories;
    } catch (error) {
      logger.error('Failed to retrieve memories:', error);
      throw error;
    }
  }

  /**
   * Build RAG context from retrieved memories
   */
  async buildContext(query: string, options?: {
    limit?: number;
    source?: string;
    minSimilarity?: number;
  }): Promise<RAGContext> {
    const memories = await this.retrieveMemories({
      query,
      limit: options?.limit || 5,
      source: options?.source,
      minSimilarity: options?.minSimilarity || 0.7,
    });

    const contextString = memories.length > 0
      ? `Relevant context from memory:\n\n${memories
          .map((m, i) => `[${i + 1}] (similarity: ${m.similarity.toFixed(2)}) ${m.content}`)
          .join('\n\n')}`
      : 'No relevant context found in memory.';

    return {
      relevantMemories: memories,
      contextString,
      sources: memories.map(m => m.source),
    };
  }

  /**
   * Store a Slack conversation in memory
   */
  async storeSlackMessage(params: {
    userId: string;
    channelId: string;
    message: string;
    threadTs?: string;
  }): Promise<string> {
    return this.storeMemory({
      content: params.message,
      source: 'slack',
      sourceId: `${params.channelId}:${params.threadTs || 'main'}`,
      metadata: {
        userId: params.userId,
        channelId: params.channelId,
        threadTs: params.threadTs,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Store an agent message in memory
   */
  async storeAgentMessage(params: {
    fromAgent: string;
    toAgent: string;
    intent: string;
    payload: Record<string, any>;
  }): Promise<string> {
    const content = `Agent ${params.fromAgent} sent message to ${params.toAgent} with intent: ${params.intent}. Payload: ${JSON.stringify(params.payload)}`;
    
    return this.storeMemory({
      content,
      source: 'agent_message',
      sourceId: uuidv4(),
      metadata: {
        fromAgent: params.fromAgent,
        toAgent: params.toAgent,
        intent: params.intent,
      },
    });
  }
}
