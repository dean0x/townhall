/**
 * Generic relationship mechanics for all simulation types.
 *
 * This module provides the shared foundation for relationships:
 * - IRelationship: Generic interface for action relationships
 * - IRelationshipValidator: Strategy pattern for validation
 * - RelationshipGraph: Pure graph operations (cycles, depth, queries)
 *
 * Simulation types define their own relationship types as string unions
 * (e.g., DebateRelationType = 'rebuts' | 'concedes_to' | 'supports').
 */

// Core relationship interface
export {
  IRelationship,
  SingleTargetRelationship,
  toRelationship,
  isRelationship,
} from './IRelationship';

// Validation interface
export {
  IRelationshipValidator,
  RelationshipValidationContext,
} from './IRelationshipValidator';

// Graph operations
export {
  RelationshipGraph,
  RelationshipChain,
  GraphStats,
} from './RelationshipGraph';
