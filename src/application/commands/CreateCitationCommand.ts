/**
 * CreateCitationCommand - Command to create a new citation
 *
 * Follows CQRS pattern: write operation that modifies state.
 */

import { CitationType } from '../../core/value-objects/CitationType';

/**
 * Command to create a citation in the active simulation
 *
 * All citations are content-addressed (hash-based IDs) to prevent duplicates.
 * Same source + metadata = same ID = deduplicated automatically.
 */
export interface CreateCitationCommand {
  /** Citation source/title (required, max 500 chars, no leading/trailing whitespace) */
  readonly source: string;

  /** Type of citation: paper, study, book, website, or report */
  readonly type: CitationType;

  /** Digital Object Identifier (optional, format: 10.xxxx/xxxxx) */
  readonly doi?: string;

  /** Web URL (optional, must use http/https, no localhost or private IPs) */
  readonly url?: string;

  /** Page number reference (optional, must be positive integer) */
  readonly page?: number;

  /** Direct quote from source (optional, max 1000 chars) */
  readonly quote?: string;

  /** Author names (optional array, no format constraints) */
  readonly authors?: string[];

  /** Publication year (optional, range: 1000 to current year + 1) */
  readonly year?: number;
}
