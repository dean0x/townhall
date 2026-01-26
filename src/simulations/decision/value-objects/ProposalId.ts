/**
 * ARCHITECTURE: Decision-specific value object - content-addressed identifier
 * Pattern: SHA-256 hashing with injected crypto service
 * Rationale: Pure domain logic without Node.js dependencies
 */

import { Brand } from '../../../shared/types';
import { Result, ok, err } from '../../../shared/result';
import { ValidationError } from '../../../shared/errors';
import { ICryptoService } from '../../../core/services/ICryptoService';

export type ProposalId = Brand<string, 'ProposalId'>;

export class ProposalIdGenerator {
  /**
   * Generate ProposalId from content using injected crypto service
   * @param content Content to hash for ID generation
   * @param cryptoService Cryptographic service for SHA-256 hashing
   */
  public static fromContent(content: string, cryptoService: ICryptoService): ProposalId {
    const hash = cryptoService.hash(content, 'sha256');
    return hash as ProposalId;
  }

  /**
   * Create ProposalId from existing hash string
   * @param hash SHA-256 hash string to validate and convert
   * @returns Result with ProposalId or ValidationError
   */
  public static fromHash(hash: string): Result<ProposalId, ValidationError> {
    if (!this.isValidHash(hash)) {
      return err(new ValidationError('Invalid SHA-256 hash format for ProposalId'));
    }
    return ok(hash as ProposalId);
  }

  /**
   * Extract short hash prefix from ProposalId
   * @param id Full ProposalId
   * @param length Number of characters for short hash (default 7)
   */
  public static getShortHash(id: ProposalId, length: number = 7): string {
    return id.slice(0, length);
  }

  /**
   * Expand short hash to full ProposalId if unambiguous
   * @param shortHash Short hash prefix to expand
   * @param availableIds List of available ProposalIds to match against
   * @returns Full ProposalId if exactly one match, null otherwise
   */
  public static expandShortHash(shortHash: string, availableIds: ProposalId[]): ProposalId | null {
    const matches = availableIds.filter(id => id.startsWith(shortHash));
    return matches.length === 1 ? matches[0]! : null;
  }

  private static isValidHash(value: string): boolean {
    return /^[a-f0-9]{64}$/i.test(value);
  }
}
