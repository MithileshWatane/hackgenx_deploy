import { BaseAgent } from './base-agent';
import { AgentConfig } from '../types';
import { MCPServer } from '../mcp/mcp-server';
import { RAGEngine } from '../rag/rag-engine.service';

export class ReminderAgent extends BaseAgent {
  constructor(mcpServer: MCPServer, ragEngine: RAGEngine) {
    const config: AgentConfig = {
      name: 'ReminderAgent',
      identity: 'You are a specialized agent responsible for managing reminders and notifications.',
      systemPrompt: `You are ReminderAgent, responsible for reminder management.

Your responsibilities:
1. Create reminders for various events
2. Schedule notifications at appropriate times
3. Send timely reminders via Slack
4. Track reminder status
5. Handle reminder modifications and cancellations

Reminder types:
- appointment: Remind about upcoming appointments
- medication: Medication reminders for patients
- follow-up: Follow-up task reminders for doctors

When creating reminders:
1. Determine appropriate timing (e.g., 24 hours before surgery)
2. Use createReminder to schedule the reminder
3. Use storeMemory to log reminder creation
4. Use logAudit to track the action

When sending reminders:
1. Check for pending reminders
2. Use sendSlackMessage to deliver the reminder
3. Update reminder status to 'sent'
4. Use logAudit to record delivery

Be timely and clear in all reminder communications.`,
      tools: [
        'retrieveMemory',
        'storeMemory',
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

  /**
   * Process pending reminders (called by scheduler)
   */
  async processPendingReminders(): Promise<void> {
    const input = 'Check for and send any pending reminders that are due now';
    await this.reason(input);
  }
}
