/**
 * ARCHITECTURE: Decision-specific value object - content-addressed identifier
 * Pattern: SHA-256 hashing with injected crypto service
 * Rationale: Pure domain logic without Node.js dependencies
 */

import { Brand } from '../../../shared/types';
import { Result, ok, err } from '../../../shared/result';
import { ValidationError } from '../../../shared/errors';
import { ICryptoService } from '../../../core/services/ICryptoService';

export type EvaluationId = Brand<string, 'EvaluationId'>;

export class EvaluationIdGenerator {
  /**
   * Generate EvaluationId from content using injected crypto service
   * @param content Content to hash for ID generation
   * @param cryptoService Cryptographic service for SHA-256 hashing
   */
  public static fromContent(content: string, cryptoService: ICryptoService): EvaluationId {
    const hash = cryptoService.hash(content, 'sha256');
    return hash as EvaluationId;
  }

  /**
   * Create EvaluationId from existing hash string
   * @param hash SHA-256 hash string to validate and convert
   * @returns Result with EvaluationId or ValidationError
   */
  public static fromHash(hash: string): Result<EvaluationId, ValidationError> {
    if (!this.isValidHash(hash)) {
      return err(new ValidationError('Invalid SHA-256 hash format for EvaluationId'));
    }
    return ok(hash as EvaluationId);
  }

  /**
   * Extract short hash prefix from EvaluationId
   * @param id Full EvaluationId
   * @param length Number of characters for short hash (default 7)
   */
  public static getShortHash(id: EvaluationId, length: number = 7): string {
    return id.slice(0, length);
  }

  /**
   * Expand short hash to full EvaluationId if unambiguous
   * @param shortHash Short hash prefix to expand
   * @param availableIds List of available EvaluationIds to match against
   * @returns Full EvaluationId if exactly one match, null otherwise
   */
  public static expandShortHash(shortHash: string, availableIds: EvaluationId[]): EvaluationId | null {
    const matches = availableIds.filter(id => id.startsWith(shortHash));
    return matches.length === 1 ? matches[0]! : null;
  }

  private static isValidHash(value: string): boolean {
    return /^[a-f0-9]{64}$/i.test(value);
  }
}
