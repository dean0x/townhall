/**
 * SimulationId value object
 * Unique identifier for debate simulations using content addressing
 */

import { createHash } from 'crypto';
import { Brand } from '../../shared/types';

export type SimulationId = Brand<string, 'SimulationId'>;

export class SimulationIdGenerator {
  public static fromTopicAndTimestamp(topic: string, timestamp: string): SimulationId {
    const content = `${topic}:${timestamp}`;
    const hash = createHash('sha256').update(content, 'utf8').digest('hex');
    return hash as SimulationId;
  }

  public static fromHash(hash: string): SimulationId {
    if (!this.isValidHash(hash)) {
      throw new Error('Invalid SHA-256 hash format');
    }
    return hash as SimulationId;
  }

  public static getShortHash(id: SimulationId, length: number = 7): string {
    return id.slice(0, length);
  }

  private static isValidHash(value: string): boolean {
    return /^[a-f0-9]{64}$/i.test(value);
  }
}