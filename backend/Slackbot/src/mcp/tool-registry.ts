import { MCPTool } from '../types';
import { RAGEngine } from '../rag/rag-engine.service';
import { prisma } from '../database/prisma.service';
import { AuditService } from '../database/audit.service';
import { logger } from '../utils/logger';
import { App as SlackApp } from '@slack/bolt';

export class ToolRegistry {
  static createRetrieveMemoryTool(ragEngine: RAGEngine): MCPTool {
    return {
      name: 'retrieveMemory',
      description: 'Retrieve relevant memories from the RAG system based on a query',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find relevant memories',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of memories to retrieve (default: 5)',
          },
          source: {
            type: 'string',
            description: 'Filter by memory source (slack, appointment, agent_message, patient_note)',
          },
        },
        required: ['query'],
      },
      handler: async (params) => {
        const memories = await ragEngine.retrieveMemories({
          query: params.query,
          limit: params.limit || 5,
          source: params.source,
          minSimilarity: 0.7,
        });
        return { memories, count: memories.length };
      },
    };
  }

  static createStoreMemoryTool(ragEngine: RAGEngine): MCPTool {
    return {
      name: 'storeMemory',
      description: 'Store a new memory in the RAG system',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The content to store in memory',
          },
          source: {
            type: 'string',
            description: 'The source of the memory (slack, appointment, agent_message, patient_note)',
          },
          sourceId: {
            type: 'string',
            description: 'Optional source identifier',
          },
          metadata: {
            type: 'object',
            description: 'Additional metadata to store with the memory',
          },
        },
        required: ['content', 'source'],
      },
      handler: async (params) => {
        const memoryId = await ragEngine.storeMemory(params);
        return { success: true, memoryId };
      },
    };
  }

  static createScheduleSurgeryTool(): MCPTool {
    return {
      name: 'scheduleSurgery',
      description: 'Schedule a surgery appointment for a patient',
      parameters: {
        type: 'object',
        properties: {
          patientId: {
            type: 'string',
            description: 'The patient ID',
          },
          doctorId: {
            type: 'string',
            description: 'The doctor ID',
          },
          scheduledAt: {
            type: 'string',
            description: 'The scheduled date and time (ISO 8601 format)',
          },
          duration: {
            type: 'number',
            description: 'Duration in minutes',
          },
          notes: {
            type: 'string',
            description: 'Additional notes about the surgery',
          },
        },
        required: ['patientId', 'doctorId', 'scheduledAt', 'duration'],
      },
      handler: async (params) => {
        const appointment = await prisma.appointment.create({
          data: {
            patientId: params.patientId,
            doctorId: params.doctorId,
            appointmentType: 'surgery',
            scheduledAt: new Date(params.scheduledAt),
            duration: params.duration,
            status: 'scheduled',
            notes: params.notes,
          },
          include: {
            patient: true,
            doctor: true,
          },
        });

        await AuditService.logAudit({
          doctorId: params.doctorId,
          agentName: 'SurgerySchedulerAgent',
          action: 'schedule_surgery',
          resource: 'appointment',
          resourceId: appointment.id,
          details: { patientId: params.patientId, scheduledAt: params.scheduledAt },
        });

        return { success: true, appointment };
      },
    };
  }

  static createCheckAvailabilityTool(): MCPTool {
    return {
      name: 'checkAvailability',
      description: 'Check doctor availability for a specific time slot',
      parameters: {
        type: 'object',
        properties: {
          doctorId: {
            type: 'string',
            description: 'The doctor ID',
          },
          startTime: {
            type: 'string',
            description: 'Start time to check (ISO 8601 format)',
          },
          endTime: {
            type: 'string',
            description: 'End time to check (ISO 8601 format)',
          },
        },
        required: ['doctorId', 'startTime', 'endTime'],
      },
      handler: async (params) => {
        const conflicts = await prisma.appointment.findMany({
          where: {
            doctorId: params.doctorId,
            status: 'scheduled',
            scheduledAt: {
              gte: new Date(params.startTime),
              lt: new Date(params.endTime),
            },
          },
        });

        return {
          available: conflicts.length === 0,
          conflicts: conflicts.length,
          conflictingAppointments: conflicts,
        };
      },
    };
  }

  static createSendSlackMessageTool(slackApp: SlackApp): MCPTool {
    return {
      name: 'sendSlackMessage',
      description: 'Send a message to Slack',
      parameters: {
        type: 'object',
        properties: {
          channel: {
            type: 'string',
            description: 'The Slack channel or user ID',
          },
          text: {
            type: 'string',
            description: 'The message text',
          },
          threadTs: {
            type: 'string',
            description: 'Optional thread timestamp to reply in thread',
          },
        },
        required: ['channel', 'text'],
      },
      handler: async (params) => {
        const result = await slackApp.client.chat.postMessage({
          channel: params.channel,
          text: params.text,
          thread_ts: params.threadTs,
        });
        return { success: true, ts: result.ts };
      },
    };
  }

  static createCreateReminderTool(): MCPTool {
    return {
      name: 'createReminder',
      description: 'Create a reminder for a doctor',
      parameters: {
        type: 'object',
        properties: {
          doctorId: {
            type: 'string',
            description: 'The doctor ID',
          },
          appointmentId: {
            type: 'string',
            description: 'Optional appointment ID',
          },
          reminderType: {
            type: 'string',
            description: 'Type of reminder (appointment, medication, follow-up)',
          },
          title: {
            type: 'string',
            description: 'Reminder title',
          },
          description: {
            type: 'string',
            description: 'Reminder description',
          },
          scheduledFor: {
            type: 'string',
            description: 'When to send the reminder (ISO 8601 format)',
          },
        },
        required: ['doctorId', 'reminderType', 'title', 'scheduledFor'],
      },
      handler: async (params) => {
        const reminder = await prisma.reminder.create({
          data: {
            doctorId: params.doctorId,
            appointmentId: params.appointmentId,
            reminderType: params.reminderType,
            title: params.title,
            description: params.description,
            scheduledFor: new Date(params.scheduledFor),
            status: 'pending',
          },
        });

        await AuditService.logAudit({
          doctorId: params.doctorId,
          agentName: 'ReminderAgent',
          action: 'create_reminder',
          resource: 'reminder',
          resourceId: reminder.id,
        });

        return { success: true, reminder };
      },
    };
  }

  static createSendAgentMessageTool(): MCPTool {
    return {
      name: 'sendAgentMessage',
      description: 'Send a message to another agent',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Target agent name',
          },
          intent: {
            type: 'string',
            description: 'The intent or purpose of the message',
          },
          payload: {
            type: 'object',
            description: 'The message payload with relevant data',
          },
          from: {
            type: 'string',
            description: 'Source agent name',
          },
        },
        required: ['to', 'intent', 'payload'],
      },
      handler: async (params) => {
        const message = await prisma.agentMessage.create({
          data: {
            fromAgent: params.from || 'unknown',
            toAgent: params.to,
            intent: params.intent,
            payload: params.payload,
            status: 'pending',
          },
        });

        logger.info(`Agent message created: ${params.from} -> ${params.to}`, {
          intent: params.intent,
          messageId: message.id,
        });

        return { success: true, messageId: message.id };
      },
    };
  }

  static createLogAuditTool(): MCPTool {
    return {
      name: 'logAudit',
      description: 'Log an audit event',
      parameters: {
        type: 'object',
        properties: {
          doctorId: {
            type: 'string',
            description: 'The doctor ID',
          },
          agentName: {
            type: 'string',
            description: 'The agent name',
          },
          action: {
            type: 'string',
            description: 'The action being logged',
          },
          resource: {
            type: 'string',
            description: 'The resource type',
          },
          resourceId: {
            type: 'string',
            description: 'The resource ID',
          },
          details: {
            type: 'object',
            description: 'Additional details',
          },
        },
        required: ['action'],
      },
      handler: async (params) => {
        await AuditService.logAudit(params);
        return { success: true };
      },
    };
  }
}
