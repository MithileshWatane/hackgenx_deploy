import dotenv from 'dotenv';
dotenv.config();

import { DatabaseService } from './database/prisma.service';
import { RAGEngine } from './rag/rag-engine.service';
import { MCPServer } from './mcp/mcp-server';
import { ToolRegistry } from './mcp/tool-registry';
import { AgentManager } from './agents/agent-manager';
import { SlackBot } from './slack/slack-bot';
import { logger } from './utils/logger';

class DoctorAIAssistant {
  private ragEngine!: RAGEngine;
  private mcpServer!: MCPServer;
  private agentManager!: AgentManager;
  private slackBot!: SlackBot;

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Doctor AI Assistant System...');

      // 1. Connect to database
      logger.info('Connecting to database...');
      await DatabaseService.connect();

      // 2. Initialize RAG Engine
      logger.info('Initializing RAG Engine...');
      this.ragEngine = new RAGEngine();
      await this.ragEngine.initialize();

      // 3. Initialize MCP Server
      logger.info('Initializing MCP Server...');
      this.mcpServer = new MCPServer(this.ragEngine);

      // 4. Register tools (we'll register Slack tools after bot initialization)
      logger.info('Registering base tools...');
      this.registerBaseTools();

      // 5. Initialize Agent Manager
      logger.info('Initializing Agent Manager...');
      this.agentManager = new AgentManager(this.mcpServer, this.ragEngine);
      await this.agentManager.initialize();

      // 6. Initialize Slack Bot
      logger.info('Initializing Slack Bot...');
      this.slackBot = new SlackBot(this.agentManager, this.ragEngine);

      // 7. Register Slack-dependent tools
      this.registerSlackTools();

      logger.info('✅ Doctor AI Assistant System initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize system:', error);
      throw error;
    }
  }

  private registerBaseTools(): void {
    // Memory tools
    this.mcpServer.registerTool(ToolRegistry.createRetrieveMemoryTool(this.ragEngine));
    this.mcpServer.registerTool(ToolRegistry.createStoreMemoryTool(this.ragEngine));

    // Patient tools
    this.mcpServer.registerTool(ToolRegistry.createRegisterPatientTool());

    // Scheduling tools
    this.mcpServer.registerTool(ToolRegistry.createScheduleSurgeryTool());
    this.mcpServer.registerTool(ToolRegistry.createCheckAvailabilityTool());

    // Reminder tools
    this.mcpServer.registerTool(ToolRegistry.createCreateReminderTool());

    // Agent communication
    this.mcpServer.registerTool(ToolRegistry.createSendAgentMessageTool());

    // Audit tools
    this.mcpServer.registerTool(ToolRegistry.createLogAuditTool());

    logger.info('Base tools registered');
  }

  private registerSlackTools(): void {
    // Slack communication tool
    this.mcpServer.registerTool(
      ToolRegistry.createSendSlackMessageTool(this.slackBot.getApp())
    );

    logger.info('Slack tools registered');
  }

  async start(): Promise<void> {
    try {
      await this.initialize();
      await this.slackBot.start();

      logger.info('🚀 Doctor AI Assistant System is running');
      logger.info('Available agents:', this.agentManager.getAgentNames());

    } catch (error) {
      logger.error('Failed to start system:', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Doctor AI Assistant System...');

    try {
      // Stop Slack bot
      if (this.slackBot) {
        await this.slackBot.stop();
      }

      // Stop agent message polling
      if (this.agentManager) {
        this.agentManager.stopMessagePolling();
      }

      // Disconnect database
      await DatabaseService.disconnect();

      logger.info('✅ System shutdown complete');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
}

// Main execution
const app = new DoctorAIAssistant();

// Start the application
app.start().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  await app.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await app.shutdown();
  process.exit(0);
});

export default app;
