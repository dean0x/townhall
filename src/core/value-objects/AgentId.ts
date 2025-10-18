/**
 * ARCHITECTURE: Core value object - framework-agnostic identifier
 * Pattern: Branded type with injected crypto service
 * Rationale: Pure domain logic without Node.js dependencies
 */

import { Brand } from '../../shared/types';
import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors';
import { ICryptoService } from '../services/ICryptoService';

export type AgentId = Brand<string, 'AgentId'>;

export class AgentIdGenerator {
  /**
   * Generate new AgentId using injected crypto service
   * @param cryptoService Cryptographic service for random UUID generation
   */
  public static generate(cryptoService: ICryptoService): AgentId {
    const bytes = cryptoService.randomBytes(16);

    // Format as UUID v4 (RFC 4122)
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

    // Format as UUID string
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const uuid = [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32),
    ].join('-');

    return uuid as AgentId;
  }

  /**
   * Create AgentId from existing UUID string
   * @param uuid UUID string to validate and convert
   * @returns Result with AgentId or ValidationError
   */
  public static fromString(uuid: string): Result<AgentId, ValidationError> {
    if (!this.isValidUUID(uuid)) {
      return err(new ValidationError('Invalid UUID format for AgentId'));
    }
    return ok(uuid as AgentId);
  }

  private static isValidUUID(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}