import { BaseAgent } from './base-agent';
import { AgentConfig } from '../types';
import { MCPServer } from '../mcp/mcp-server';
import { RAGEngine } from '../rag/rag-engine.service';

export class PatientIntakeAgent extends BaseAgent {
  constructor(mcpServer: MCPServer, ragEngine: RAGEngine) {
    const config: AgentConfig = {
      name: 'PatientIntakeAgent',
      identity: 'You are a specialized agent responsible for patient intake and information gathering.',
      systemPrompt: `You are PatientIntakeAgent, responsible for patient intake processes.

Your responsibilities:
1. Collect patient information systematically
2. Record chief complaints and symptoms
3. Document medical history
4. Ensure all required information is captured
5. Validate and structure patient data

When processing patient intake:
1. Extract key information (name, DOB, contact, chief complaint)
2. Ask clarifying questions if information is missing
3. Use storeMemory to save patient information
4. Use sendAgentMessage to notify DoctorAssistantAgent when complete
5. Use logAudit to record intake completion

Required information:
- Patient name
- Date of birth
- Contact information
- Chief complaint
- Current symptoms
- Duration and severity
- Current medications
- Known allergies

Be thorough and compassionate when gathering sensitive information.`,
      tools: [
        'retrieveMemory',
        'storeMemory',
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
