/**
 * AgentId value object (UUID)
 * Unique identifier for debate participants
 */

import { randomUUID } from 'crypto';
import { Brand } from '../../shared/types';

export type AgentId = Brand<string, 'AgentId'>;

export class AgentIdGenerator {
  public static generate(): AgentId {
    return randomUUID() as AgentId;
  }

  public static fromString(uuid: string): AgentId {
    if (!this.isValidUUID(uuid)) {
      throw new Error('Invalid UUID format');
    }
    return uuid as AgentId;
  }

  private static isValidUUID(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}