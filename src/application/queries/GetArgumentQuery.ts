/**
 * ARCHITECTURE: Application layer query for single argument
 * Pattern: Query with identifier lookup
 * Rationale: Supports both full and short hash lookup
 */

import { ArgumentId } from '../../core/value-objects/ArgumentId';

export interface GetArgumentQuery {
  readonly argumentId: ArgumentId | string; // Full hash or short hash
  readonly includeRelationships?: boolean;
}