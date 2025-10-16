/**
 * ARCHITECTURE: Application layer port for timestamp operations
 * Pattern: Adapter interface for framework-agnostic time operations
 * Rationale: Allows Core layer to remain deterministic and testable
 */

/**
 * Timestamp service interface for Core layer usage
 *
 * This interface abstracts timestamp generation away from system clock access,
 * allowing Core layer to remain pure and testable with deterministic timestamps.
 *
 * Implementations:
 * - SystemTimestampService: Production adapter using Date.now()
 * - MockTimestampService: Test double for deterministic testing
 */
export interface ITimestampService {
  /**
   * Get current timestamp as ISO 8601 string
   * @returns ISO 8601 formatted timestamp string
   */
  now(): string;

  /**
   * Parse ISO 8601 timestamp string to Date object
   * @param isoString ISO 8601 formatted timestamp
   * @returns Date object
   */
  parse(isoString: string): Date;

  /**
   * Format Date object to ISO 8601 string
   * @param date Date to format
   * @returns ISO 8601 formatted timestamp string
   */
  format(date: Date): string;
}
