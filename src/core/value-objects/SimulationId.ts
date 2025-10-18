/**
 * SimulationId value object
 * Unique identifier for debate simulations using content addressing
 *
 * ARCHITECTURE: Core value object with injected crypto dependency
 * Pattern: Service injection into static factory method
 * Rationale: Core layer must remain framework-agnostic and testable
 */

import { Brand } from '../../shared/types';
import type { ICryptoService } from '../services/ICryptoService';
import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors';

export type SimulationId = Brand<string, 'SimulationId'>;

export class SimulationIdGenerator {
  public static fromTopicAndTimestamp(
    topic: string,
    timestamp: string,
    cryptoService: ICryptoService
  ): Result<SimulationId, ValidationError> {
    try {
      const content = `${topic}:${timestamp}`;
      const hash = cryptoService.hash(content, 'sha256');
      return ok(hash as SimulationId);
    } catch (error) {
      return err(new ValidationError('Failed to generate simulation ID hash', 'simulationId'));
    }
  }

  public static fromHash(hash: string): Result<SimulationId, ValidationError> {
    if (!this.isValidHash(hash)) {
      return err(new ValidationError('Invalid SHA-256 hash format', 'simulationId'));
    }
    return ok(hash as SimulationId);
  }

  public static getShortHash(id: SimulationId, length: number = 7): string {
    return id.slice(0, length);
  }

  private static isValidHash(value: string): boolean {
    return /^[a-f0-9]{64}$/i.test(value);
  }
}