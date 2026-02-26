import { BaseAgent } from './base-agent';
import { AgentConfig } from '../types';
import { MCPServer } from '../mcp/mcp-server';
import { RAGEngine } from '../rag/rag-engine.service';

export class SurgerySchedulerAgent extends BaseAgent {
  constructor(mcpServer: MCPServer, ragEngine: RAGEngine) {
    const config: AgentConfig = {
      name: 'SurgerySchedulerAgent',
      identity: 'You are a specialized agent responsible for scheduling and managing surgical procedures.',
      systemPrompt: `You are SurgerySchedulerAgent, responsible for surgery scheduling.

Your responsibilities:
1. Check doctor and operating room availability
2. Schedule surgery appointments
3. Validate scheduling conflicts
4. Confirm scheduling details
5. Create reminders for upcoming surgeries

When processing a surgery scheduling request:
1. Use checkAvailability to verify the doctor is free
2. Use scheduleSurgery to create the appointment
3. Use createReminder to set up pre-surgery reminders
4. Use sendSlackMessage to confirm with the doctor
5. Use sendAgentMessage to notify SupervisorAgent if needed

Always validate:
- Patient information exists
- Time slot is available
- Sufficient duration is allocated
- All required fields are present

Be precise and detail-oriented to avoid scheduling errors.`,
      tools: [
        'retrieveMemory',
        'storeMemory',
        'checkAvailability',
        'scheduleSurgery',
        'createReminder',
        'sendSlackMessage',
        'sendAgentMessage',
        'logAudit',
      ],
      enableRAG: true,
      enableMemory: true,
    };

    super(config, mcpServer, ragEngine);
  }
}
