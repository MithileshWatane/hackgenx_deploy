import { RAGEngine } from '../rag/rag-engine.service';
import { logger } from '../utils/logger';

export class MemoryService {
  private ragEngine: RAGEngine;

  constructor(ragEngine: RAGEngine) {
    this.ragEngine = ragEngine;
  }

  /**
   * Store a patient note in memory
   */
  async storePatientNote(params: {
    patientId: string;
    doctorId: string;
    note: string;
  }): Promise<string> {
    const content = `Patient note for ${params.patientId} by doctor ${params.doctorId}: ${params.note}`;
    
    return this.ragEngine.storeMemory({
      content,
      source: 'patient_note',
      sourceId: params.patientId,
      metadata: {
        doctorId: params.doctorId,
        patientId: params.patientId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Store appointment information in memory
   */
  async storeAppointmentMemory(params: {
    appointmentId: string;
    patientId: string;
    doctorId: string;
    type: string;
    scheduledAt: Date;
    notes?: string;
  }): Promise<string> {
    const content = `Appointment scheduled: ${params.type} for patient ${params.patientId} with doctor ${params.doctorId} on ${params.scheduledAt.toISOString()}. ${params.notes || ''}`;
    
    return this.ragEngine.storeMemory({
      content,
      source: 'appointment',
      sourceId: params.appointmentId,
      metadata: {
        appointmentId: params.appointmentId,
        patientId: params.patientId,
        doctorId: params.doctorId,
        type: params.type,
        scheduledAt: params.scheduledAt.toISOString(),
      },
    });
  }

  /**
   * Retrieve memories related to a patient
   */
  async getPatientMemories(patientId: string, limit: number = 10) {
    return this.ragEngine.retrieveMemories({
      query: `patient ${patientId}`,
      limit,
      minSimilarity: 0.6,
    });
  }

  /**
   * Retrieve memories related to a doctor
   */
  async getDoctorMemories(doctorId: string, limit: number = 10) {
    return this.ragEngine.retrieveMemories({
      query: `doctor ${doctorId}`,
      limit,
      minSimilarity: 0.6,
    });
  }

  /**
   * Search memories by topic
   */
  async searchMemories(query: string, options?: {
    limit?: number;
    source?: string;
    minSimilarity?: number;
  }) {
    return this.ragEngine.retrieveMemories({
      query,
      limit: options?.limit || 10,
      source: options?.source,
      minSimilarity: options?.minSimilarity || 0.7,
    });
  }

  /**
   * Get recent conversation context for a channel
   */
  async getConversationContext(channelId: string, limit: number = 5) {
    return this.ragEngine.retrieveMemories({
      query: channelId,
      limit,
      source: 'slack',
      minSimilarity: 0.5,
    });
  }
}
