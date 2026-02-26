import { prisma } from './prisma.service';
import { SecurityService } from '../security/security.service';
import { logger } from '../utils/logger';

export class AuditService {
  /**
   * Log an audit event
   */
  static async logAudit(params: {
    doctorId?: string;
    agentName?: string;
    action: string;
    resource?: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      // Mask sensitive data before logging
      const maskedDetails = params.details 
        ? SecurityService.maskSensitiveData(params.details)
        : null;

      await prisma.auditLog.create({
        data: {
          doctorId: params.doctorId,
          agentName: params.agentName,
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId,
          details: maskedDetails,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });

      logger.info('Audit log created', { 
        action: params.action, 
        resource: params.resource,
        agentName: params.agentName 
      });
    } catch (error) {
      logger.error('Failed to create audit log:', error);
      // Don't throw - audit failures shouldn't break the main flow
    }
  }

  /**
   * Query audit logs
   */
  static async getAuditLogs(filters: {
    doctorId?: string;
    agentName?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    return prisma.auditLog.findMany({
      where: {
        doctorId: filters.doctorId,
        agentName: filters.agentName,
        action: filters.action,
        createdAt: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 100,
    });
  }
}
