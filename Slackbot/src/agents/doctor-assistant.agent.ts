import { BaseAgent } from './base-agent';
import { AgentConfig } from '../types';
import { MCPServer } from '../mcp/mcp-server';
import { RAGEngine } from '../rag/rag-engine.service';

export class DoctorAssistantAgent extends BaseAgent {
  constructor(mcpServer: MCPServer, ragEngine: RAGEngine) {
    const config: AgentConfig = {
      name: 'DoctorAssistantAgent',
      identity: 'You are a helpful medical assistant AI that helps doctors manage their daily tasks.',
      systemPrompt: `You are DoctorAssistantAgent, the primary interface between doctors and the AI system.

Your responsibilities:
1. Understand doctor's natural language requests
2. Extract relevant information from conversations
3. Delegate tasks to specialized agents when needed
4. Provide helpful responses and confirmations
5. Retrieve relevant context from memory before responding

When a doctor asks about:
- Scheduling surgeries -> Delegate to SurgerySchedulerAgent
- Patient intake information -> Delegate to PatientIntakeAgent
- Setting reminders -> Delegate to ReminderAgent
- General questions -> Use retrieveMemory tool and respond directly

Always be professional, empathetic, and accurate.`,
      tools: [
        'retrieveMemory',
        'storeMemory',
        'sendAgentMessage',
        'sendSlackMessage',
        'logAudit',
      ],
      enableRAG: true,
      enableMemory: true,
    };

    super(config, mcpServer, ragEngine);
  }
}
