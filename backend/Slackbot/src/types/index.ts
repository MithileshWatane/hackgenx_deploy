export interface MCPTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (params: any) => Promise<any>;
}

export interface MCPContext {
  ragContext?: string;
  conversationHistory?: string[];
  metadata?: Record<string, any>;
}

export interface ToolCall {
  tool: string;
  parameters: Record<string, any>;
}

export interface AgentMessage {
  to: string;
  intent: string;
  payload: Record<string, any>;
  from?: string;
}

export interface ReasoningStep {
  thought: string;
  action: 'tool_call' | 'respond' | 'delegate' | 'wait';
  tool?: string;
  toolInput?: Record<string, any>;
  observation?: string;
}

export interface AgentConfig {
  name: string;
  identity: string;
  systemPrompt: string;
  tools: string[];
  enableRAG: boolean;
  enableMemory: boolean;
}

export interface RAGContext {
  relevantMemories: MemoryResult[];
  contextString: string;
  sources: string[];
}

export interface MemoryResult {
  id: string;
  content: string;
  similarity: number;
  source: string;
  sourceId?: string;
  metadata?: Record<string, any>;
}

export interface EmbeddingRequest {
  text: string;
  source: string;
  sourceId?: string;
  metadata?: Record<string, any>;
}

export interface SlackContext {
  userId: string;
  channelId: string;
  threadTs?: string;
  text: string;
}

export interface SecurityContext {
  doctorId?: string;
  roles: string[];
  permissions: string[];
}
