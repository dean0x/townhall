/**
 * ARCHITECTURE: Application layer query for argument chains
 * Pattern: Query for relationship traversal
 * Rationale: Provides debate structure analysis
 */

import { ArgumentId } from '../../core/value-objects/ArgumentId';

export interface GetArgumentChainQuery {
  readonly rootArgumentId: ArgumentId;
  readonly maxDepth?: number;
  readonly includeMetadata?: boolean;
}