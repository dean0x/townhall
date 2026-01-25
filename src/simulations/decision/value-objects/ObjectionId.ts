/**
 * ARCHITECTURE: Decision-specific value object - content-addressed identifier
 * Pattern: SHA-256 hashing with injected crypto service
 * Rationale: Pure domain logic without Node.js dependencies
 */

import { Brand } from '../../../shared/types';
import { Result, ok, err } from '../../../shared/result';
import { ValidationError } from '../../../shared/errors';
import { ICryptoService } from '../../../core/services/ICryptoService';

export type ObjectionId = Brand<string, 'ObjectionId'>;

export class ObjectionIdGenerator {
  /**
   * Generate ObjectionId from content using injected crypto service
   * @param content Content to hash for ID generation
   * @param cryptoService Cryptographic service for SHA-256 hashing
   */
  public static fromContent(content: string, cryptoService: ICryptoService): ObjectionId {
    const hash = cryptoService.hash(content, 'sha256');
    return hash as ObjectionId;
  }

  /**
   * Create ObjectionId from existing hash string
   * @param hash SHA-256 hash string to validate and convert
   * @returns Result with ObjectionId or ValidationError
   */
  public static fromHash(hash: string): Result<ObjectionId, ValidationError> {
    if (!this.isValidHash(hash)) {
      return err(new ValidationError('Invalid SHA-256 hash format for ObjectionId'));
    }
    return ok(hash as ObjectionId);
  }

  /**
   * Extract short hash prefix from ObjectionId
   * @param id Full ObjectionId
   * @param length Number of characters for short hash (default 7)
   */
  public static getShortHash(id: ObjectionId, length: number = 7): string {
    return id.slice(0, length);
  }

  /**
   * Expand short hash to full ObjectionId if unambiguous
   * @param shortHash Short hash prefix to expand
   * @param availableIds List of available ObjectionIds to match against
   * @returns Full ObjectionId if exactly one match, null otherwise
   */
  public static expandShortHash(shortHash: string, availableIds: ObjectionId[]): ObjectionId | null {
    const matches = availableIds.filter(id => id.startsWith(shortHash));
    return matches.length === 1 ? matches[0]! : null;
  }

  private static isValidHash(value: string): boolean {
    return /^[a-f0-9]{64}$/i.test(value);
  }
}
