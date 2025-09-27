/**
 * ArgumentId value object with SHA-256 hashing
 * Content-addressed identifier for arguments
 */

import { createHash } from 'crypto';
import { Brand } from '../../shared/types';

export type ArgumentId = Brand<string, 'ArgumentId'>;

export class ArgumentIdGenerator {
  public static fromContent(content: string): ArgumentId {
    const hash = createHash('sha256').update(content, 'utf8').digest('hex');
    return hash as ArgumentId;
  }

  public static fromHash(hash: string): ArgumentId {
    if (!this.isValidHash(hash)) {
      throw new Error('Invalid SHA-256 hash format');
    }
    return hash as ArgumentId;
  }

  public static getShortHash(id: ArgumentId, length: number = 7): string {
    return id.slice(0, length);
  }

  public static expandShortHash(shortHash: string, availableIds: ArgumentId[]): ArgumentId | null {
    const matches = availableIds.filter(id => id.startsWith(shortHash));
    return matches.length === 1 ? matches[0]! : null;
  }

  private static isValidHash(value: string): boolean {
    return /^[a-f0-9]{64}$/i.test(value);
  }
}