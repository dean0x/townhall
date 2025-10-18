/**
 * Timestamp value object (ISO 8601)
 * Immutable timestamp representation
 */

import { Brand } from '../../shared/types';
import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors';

export type Timestamp = Brand<string, 'Timestamp'>;

export class TimestampGenerator {
  public static now(): Timestamp {
    return new Date().toISOString() as Timestamp;
  }

  public static fromDate(date: Date): Timestamp {
    return date.toISOString() as Timestamp;
  }

  public static fromString(isoString: string): Result<Timestamp, ValidationError> {
    if (!this.isValidISO8601(isoString)) {
      return err(new ValidationError('Invalid ISO 8601 timestamp format', 'timestamp'));
    }
    return ok(isoString as Timestamp);
  }

  public static toDate(timestamp: Timestamp): Result<Date, ValidationError> {
    try {
      const date = new Date(timestamp);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return err(new ValidationError('Invalid timestamp: cannot convert to Date', 'timestamp'));
      }
      return ok(date);
    } catch (error) {
      return err(new ValidationError('Invalid timestamp: cannot convert to Date', 'timestamp'));
    }
  }

  public static compare(a: Timestamp, b: Timestamp): Result<number, ValidationError> {
    const dateAResult = this.toDate(a);
    if (!dateAResult.isOk()) {
      return dateAResult;
    }

    const dateBResult = this.toDate(b);
    if (!dateBResult.isOk()) {
      return dateBResult;
    }

    return ok(dateAResult.value.getTime() - dateBResult.value.getTime());
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