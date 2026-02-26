import { MCPTool, MCPContext } from '../types';
import { logger } from '../utils/logger';
import { RAGEngine } from '../rag/rag-engine.service';

export class MCPServer {
  private tools: Map<string, MCPTool> = new Map();
  private ragEngine: RAGEngine;

  constructor(ragEngine: RAGEngine) {
    this.ragEngine = ragEngine;
  }

  /**
   * Register a tool in the MCP registry
   */
  registerTool(tool: MCPTool): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool ${tool.name} already registered, overwriting`);
    }
    
    this.tools.set(tool.name, tool);
    logger.info(`Tool registered: ${tool.name}`);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool definitions for LLM context
   */
  getToolDefinitions(toolNames?: string[]): any[] {
    const tools = toolNames
      ? toolNames.map(name => this.tools.get(name)).filter(Boolean)
      : this.getAllTools();

    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool!.name,
        description: tool!.description,
        parameters: tool!.parameters,
      },
    }));
  }

  /**
   * Execute a tool call
   */
  async executeTool(toolName: string, parameters: any): Promise<any> {
    const tool = this.tools.get(toolName);
    
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    try {
      logger.info(`Executing tool: ${toolName}`, { parameters });
      const result = await tool.handler(parameters);
      logger.info(`Tool execution completed: ${toolName}`);
      return result;
    } catch (error) {
      logger.error(`Tool execution failed: ${toolName}`, { error });
      throw error;
    }
  }

  /**
   * Build MCP context with RAG retrieval
   */
  async buildMCPContext(params: {
    query: string;
    conversationHistory?: string[];
    metadata?: Record<string, any>;
    ragOptions?: {
      enabled: boolean;
      limit?: number;
      source?: string;
      minSimilarity?: number;
    };
  }): Promise<MCPContext> {
    const context: MCPContext = {
      conversationHistory: params.conversationHistory,
      metadata: params.metadata,
    };

    // Add RAG context if enabled
    if (params.ragOptions?.enabled !== false) {
      const ragContext = await this.ragEngine.buildContext(
        params.query,
        params.ragOptions
      );
      context.ragContext = ragContext.contextString;
    }

    return context;
  }

  /**
   * Inject context into system prompt
   */
  injectContext(basePrompt: string, context: MCPContext): string {
    let enhancedPrompt = basePrompt;

    // Add RAG context
    if (context.ragContext) {
      enhancedPrompt += `\n\n${context.ragContext}`;
    }

    // Add conversation history
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      enhancedPrompt += `\n\nRecent conversation:\n${context.conversationHistory.join('\n')}`;
    }

    // Add metadata
    if (context.metadata) {
      enhancedPrompt += `\n\nContext metadata: ${JSON.stringify(context.metadata)}`;
    }

    return enhancedPrompt;
  }
}
