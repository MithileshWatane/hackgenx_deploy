import { App, LogLevel } from '@slack/bolt';
import { AgentManager } from '../agents/agent-manager';
import { RAGEngine } from '../rag/rag-engine.service';
import { prisma } from '../database/prisma.service';
import { logger } from '../utils/logger';

export class SlackBot {
  private app: App;
  private agentManager: AgentManager;
  private ragEngine: RAGEngine;

  constructor(agentManager: AgentManager, ragEngine: RAGEngine) {
    this.agentManager = agentManager;
    this.ragEngine = ragEngine;

    // Initialize Slack app
    this.app = new App({
      token: process.env.SLACK_BOT_TOKEN!,
      signingSecret: process.env.SLACK_SIGNING_SECRET!,
      socketMode: true,
      appToken: process.env.SLACK_APP_TOKEN!,
      logLevel: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
    });

    this.setupListeners();
  }

  /**
   * Setup Slack event listeners
   */
  private setupListeners(): void {
    // Listen for app mentions
    this.app.event('app_mention', async ({ event, client, say }) => {
      try {
        logger.info('Received app mention', { user: event.user, text: event.text });

        // Extract the message (remove the bot mention)
        const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();

        if (!text) {
          await say('How can I help you today?');
          return;
        }

        // Get or create doctor record
        const doctor = await this.getOrCreateDoctor(event.user!, client);

        // Store Slack message in memory
        await this.ragEngine.storeSlackMessage({
          userId: event.user!,
          channelId: event.channel,
          message: text,
          threadTs: event.thread_ts,
        });

        // Show typing indicator
        await client.reactions.add({
          channel: event.channel,
          timestamp: event.ts,
          name: 'hourglass_flowing_sand',
        });

        // Route to DoctorAssistantAgent (primary entry point)
        const response = await this.agentManager.routeMessage(
          'DoctorAssistantAgent',
          text,
          {
            slackUserId: event.user,
            doctorId: doctor.id,
            channelId: event.channel,
            threadTs: event.thread_ts,
          }
        );

        // Remove typing indicator
        await client.reactions.remove({
          channel: event.channel,
          timestamp: event.ts,
          name: 'hourglass_flowing_sand',
        });

        // Add checkmark
        await client.reactions.add({
          channel: event.channel,
          timestamp: event.ts,
          name: 'white_check_mark',
        });

        // Send response
        await say({
          text: response,
          thread_ts: event.thread_ts,
        });

        logger.info('Response sent to Slack', { user: event.user });

      } catch (error) {
        logger.error('Error handling app mention:', error);
        await say('Sorry, I encountered an error processing your request. Please try again.');
      }
    });

    // Listen for direct messages
    this.app.event('message', async ({ event, client, say }) => {
      // Ignore bot messages and threaded messages
      if ('bot_id' in event || event.subtype || event.thread_ts) {
        return;
      }

      try {
        logger.info('Received direct message', { user: event.user, text: event.text });

        const doctor = await this.getOrCreateDoctor(event.user, client);

        // Store in memory
        await this.ragEngine.storeSlackMessage({
          userId: event.user,
          channelId: event.channel,
          message: event.text || '',
        });

        // Show typing indicator
        await client.reactions.add({
          channel: event.channel,
          timestamp: event.ts,
          name: 'hourglass_flowing_sand',
        });

        // Route to DoctorAssistantAgent
        const response = await this.agentManager.routeMessage(
          'DoctorAssistantAgent',
          event.text || '',
          {
            slackUserId: event.user,
            doctorId: doctor.id,
            channelId: event.channel,
          }
        );

        // Remove typing indicator
        await client.reactions.remove({
          channel: event.channel,
          timestamp: event.ts,
          name: 'hourglass_flowing_sand',
        });

        // Send response
        await say(response);

        logger.info('Response sent to Slack', { user: event.user });

      } catch (error) {
        logger.error('Error handling direct message:', error);
        await say('Sorry, I encountered an error. Please try again.');
      }
    });

    // Slash command for quick actions
    this.app.command('/doctor-ai', async ({ command, ack, say }) => {
      await ack();

      try {
        const doctor = await this.getOrCreateDoctor(command.user_id, this.app.client);

        const response = await this.agentManager.routeMessage(
          'DoctorAssistantAgent',
          command.text,
          {
            slackUserId: command.user_id,
            doctorId: doctor.id,
            channelId: command.channel_id,
          }
        );

        await say(response);
      } catch (error) {
        logger.error('Error handling slash command:', error);
        await say('Sorry, I encountered an error processing your command.');
      }
    });
  }

  /**
   * Get or create doctor record from Slack user
   */
  private async getOrCreateDoctor(slackUserId: string, client: any): Promise<any> {
    // Check if doctor exists
    let doctor = await prisma.doctor.findUnique({
      where: { slackUserId },
    });

    if (!doctor) {
      // Get user info from Slack
      const userInfo = await client.users.info({ user: slackUserId });

      doctor = await prisma.doctor.create({
        data: {
          slackUserId,
          name: userInfo.user.real_name || userInfo.user.name,
          email: userInfo.user.profile.email || `${slackUserId}@slack.local`,
        },
      });

      logger.info('Created new doctor record', { doctorId: doctor.id, slackUserId });
    }

    return doctor;
  }

  /**
   * Start the Slack bot
   */
  async start(): Promise<void> {
    const port = process.env.SLACK_PORT || 3000;
    await this.app.start();
    logger.info(`⚡️ Slack bot is running on port ${port}`);
  }

  /**
   * Stop the Slack bot
   */
  async stop(): Promise<void> {
    await this.app.stop();
    logger.info('Slack bot stopped');
  }

  /**
   * Get the Slack app instance
   */
  getApp(): App {
    return this.app;
  }
}
