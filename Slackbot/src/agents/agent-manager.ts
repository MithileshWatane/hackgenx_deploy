import { BaseAgent } from './base-agent';
import { DoctorAssistantAgent } from './doctor-assistant.agent';
import { SurgerySchedulerAgent } from './surgery-scheduler.agent';
import { PatientIntakeAgent } from './patient-intake.agent';
import { ReminderAgent } from './reminder.agent';
import { SupervisorAgent } from './supervisor.agent';
import { MCPServer } from '../mcp/mcp-server';
import { RAGEngine } from '../rag/rag-engine.service';
import { prisma } from '../database/prisma.service';
import { logger } from '../utils/logger';

export class AgentManager {
  private agents: Map<string, BaseAgent> = new Map();
  private mcpServer: MCPServer;
  private ragEngine: RAGEngine;
  private messagePollingInterval?: NodeJS.Timeout;

  constructor(mcpServer: MCPServer, ragEngine: RAGEngine) {
    this.mcpServer = mcpServer;
    this.ragEngine = ragEngine;
  }

  /**
   * Initialize all agents
   */
  async initialize(): Promise<void> {
    // Create all agents
    const doctorAssistant = new DoctorAssistantAgent(this.mcpServer, this.ragEngine);
    const surgeryScheduler = new SurgerySchedulerAgent(this.mcpServer, this.ragEngine);
    const patientIntake = new PatientIntakeAgent(this.mcpServer, this.ragEngine);
    const reminder = new ReminderAgent(this.mcpServer, this.ragEngine);
    const supervisor = new SupervisorAgent(this.mcpServer, this.ragEngine);

    // Register agents
    this.agents.set(doctorAssistant.getName(), doctorAssistant);
    this.agents.set(surgeryScheduler.getName(), surgeryScheduler);
    this.agents.set(patientIntake.getName(), patientIntake);
    this.agents.set(reminder.getName(), reminder);
    this.agents.set(supervisor.getName(), supervisor);

    logger.info('All agents initialized', {
      agents: Array.from(this.agents.keys()),
    });

    // Start message polling
    this.startMessagePolling();
  }

  /**
   * Get an agent by name
   */
  getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Route a message to the appropriate agent
   */
  async routeMessage(agentName: string, input: string, context?: Record<string, any>): Promise<string> {
    const agent = this.agents.get(agentName);
    
    if (!agent) {
      throw new Error(`Agent not found: ${agentName}`);
    }

    return agent.reason(input, context);
  }

  /**
   * Poll for pending agent messages and process them
   */
  private startMessagePolling(): void {
    logger.info('Starting agent message polling');

    this.messagePollingInterval = setInterval(async () => {
      try {
        await this.processPendingMessages();
      } catch (error) {
        logger.error('Error processing pending messages:', error);
      }
    }, 5000); // Poll every 5 seconds
  }

  /**
   * Process pending agent messages
   */
  private async processPendingMessages(): Promise<void> {
    const pendingMessages = await prisma.agentMessage.findMany({
      where: {
        status: 'pending',
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 10, // Process up to 10 messages at a time
    });

    if (pendingMessages.length === 0) {
      return;
    }

    logger.info(`Processing ${pendingMessages.length} pending agent messages`);

    for (const message of pendingMessages) {
      try {
        // Mark as processing
        await prisma.agentMessage.update({
          where: { id: message.id },
          data: { status: 'processing' },
        });

        // Get target agent
        const agent = this.agents.get(message.toAgent);
        
        if (!agent) {
          logger.error(`Target agent not found: ${message.toAgent}`);
          await prisma.agentMessage.update({
            where: { id: message.id },
            data: {
              status: 'failed',
              errorMessage: `Agent not found: ${message.toAgent}`,
            },
          });
          continue;
        }

        // Process the message
        const result = await agent.processAgentMessage({
          from: message.fromAgent,
          intent: message.intent,
          payload: message.payload as Record<string, any>,
        });

        // Mark as processed
        await prisma.agentMessage.update({
          where: { id: message.id },
          data: {
            status: 'processed',
            processedAt: new Date(),
            result: { response: result },
          },
        });

        logger.info(`Agent message processed successfully`, {
          messageId: message.id,
          from: message.fromAgent,
          to: message.toAgent,
        });

      } catch (error: any) {
        logger.error(`Failed to process agent message ${message.id}:`, error);
        
        await prisma.agentMessage.update({
          where: { id: message.id },
          data: {
            status: 'failed',
            errorMessage: error.message,
          },
        });
      }
    }
  }

  /**
   * Stop message polling
   */
  stopMessagePolling(): void {
    if (this.messagePollingInterval) {
      clearInterval(this.messagePollingInterval);
      logger.info('Agent message polling stopped');
    }
  }

  /**
   * Get all agent names
   */
  getAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }
}
