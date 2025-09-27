/**
 * Timestamp value object (ISO 8601)
 * Immutable timestamp representation
 */

import { Brand } from '../../shared/types';

export type Timestamp = Brand<string, 'Timestamp'>;

export class TimestampGenerator {
  public static now(): Timestamp {
    return new Date().toISOString() as Timestamp;
  }

  public static fromDate(date: Date): Timestamp {
    return date.toISOString() as Timestamp;
  }

  public static fromString(isoString: string): Timestamp {
    if (!this.isValidISO8601(isoString)) {
      throw new Error('Invalid ISO 8601 timestamp format');
    }
    return isoString as Timestamp;
  }

  public static toDate(timestamp: Timestamp): Date {
    return new Date(timestamp);
  }

  public static compare(a: Timestamp, b: Timestamp): number {
    const dateA = this.toDate(a);
    const dateB = this.toDate(b);
    return dateA.getTime() - dateB.getTime();
  }

  private static isValidISO8601(value: string): boolean {
    try {
      const date = new Date(value);
      return date.toISOString() === value;
    } catch {
      return false;
    }
  }
}