import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export class DatabaseService {
  private static instance: PrismaClient;

  static getInstance(): PrismaClient {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' 
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
      });
      
      logger.info('Database connection initialized');
    }
    return DatabaseService.instance;
  }

  static async connect(): Promise<void> {
    try {
      await this.getInstance().$connect();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  static async disconnect(): Promise<void> {
    await this.getInstance().$disconnect();
    logger.info('Database disconnected');
  }
}

export const prisma = DatabaseService.getInstance();
