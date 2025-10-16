/**
 * ARCHITECTURE: Infrastructure implementation of ITimestampService
 * Pattern: Adapter for system clock access
 * Rationale: Isolates side effects from Core layer
 */

import { injectable } from 'tsyringe';
import { ITimestampService } from '../../application/ports/ITimestampService';

/**
 * Production implementation of ITimestampService using system clock
 *
 * This adapter wraps Date operations to provide timestamp functionality
 * to the Core layer without creating a direct dependency on Date.
 */
@injectable()
export class SystemTimestampService implements ITimestampService {
  /**
   * Get current timestamp from system clock as ISO 8601 string
   */
  public now(): string {
    return new Date().toISOString();
  }

  /**
   * Parse ISO 8601 timestamp string to Date object
   */
  public parse(isoString: string): Date {
    return new Date(isoString);
  }

  /**
   * Format Date object to ISO 8601 string
   */
  public format(date: Date): string {
    return date.toISOString();
  }
}
