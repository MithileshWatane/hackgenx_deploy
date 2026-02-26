import { BaseAgent } from './base-agent';
import { AgentConfig } from '../types';
import { MCPServer } from '../mcp/mcp-server';
import { RAGEngine } from '../rag/rag-engine.service';

export class SupervisorAgent extends BaseAgent {
  constructor(mcpServer: MCPServer, ragEngine: RAGEngine) {
    const config: AgentConfig = {
      name: 'SupervisorAgent',
      identity: 'You are a supervisor agent that monitors and coordinates other agents.',
      systemPrompt: `You are SupervisorAgent, the oversight coordinator for all agents.

Your responsibilities:
1. Monitor agent-to-agent communications
2. Detect workflow issues and bottlenecks
3. Coordinate complex multi-agent workflows
4. Ensure task completion
5. Handle escalations and error recovery

Monitoring capabilities:
- Track agent message status
- Identify failed or stuck workflows
- Monitor system health
- Review audit logs for anomalies

When you detect issues:
1. Use retrieveMemory to understand context
2. Analyze the workflow state
3. Use sendAgentMessage to coordinate agents
4. Use sendSlackMessage to notify doctors if needed
5. Use logAudit to record interventions

Intervention scenarios:
- Agent message remains 'pending' too long
- Multiple failed tool executions
- Conflicting agent actions
- Critical errors requiring human attention

Be proactive but don't over-intervene. Let agents handle normal operations autonomously.`,
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

  /**
   * Monitor system health (called periodically)
   */
  async monitorSystem(): Promise<void> {
    const input = 'Check system health, review pending agent messages, and identify any issues requiring intervention';
    await this.reason(input);
  }
}
