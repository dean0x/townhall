/**
 * ARCHITECTURE: Zod schemas for storage layer validation
 * Pattern: Parse, don't validate - validate at system boundaries
 * Rationale: Type-safe deserialization with runtime validation
 *
 * These schemas define the shape of data stored in the object storage.
 * They are used to parse data when reading from storage, ensuring
 * type safety at runtime while maintaining TypeScript type inference.
 */

import { z } from 'zod';
import { Result, ok, err } from '../../shared/result';
import { StorageError } from '../../shared/errors';

// =============================================================================
// Primitive Schemas
// =============================================================================

/**
 * Branded string schemas for type-safe IDs
 */
export const ArgumentIdSchema = z.string().min(1).max(256);
export const SimulationIdSchema = z.string().min(1).max(256);
export const AgentIdSchema = z.string().min(1).max(256);
export const CitationIdSchema = z.string().min(1).max(256);
export const TimestampSchema = z.string().min(1); // ISO 8601 format

// =============================================================================
// Argument Schemas
// =============================================================================

/**
 * Evidence schema for empirical arguments
 */
export const EvidenceSchema = z.object({
  source: z.string().min(1),
  citation: z.string().optional(),
  relevance: z.string().min(1),
}).readonly();

/**
 * Deductive argument structure
 * Uses readonly arrays to match domain types
 */
export const DeductiveStructureSchema = z.object({
  premises: z.array(z.string()).min(2).readonly(),
  conclusion: z.string().min(1),
  form: z.string().optional(),
}).readonly();

/**
 * Inductive argument structure
 * Uses readonly arrays to match domain types
 */
export const InductiveStructureSchema = z.object({
  observations: z.array(z.string()).min(2).readonly(),
  generalization: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
}).readonly();

/**
 * Empirical argument structure
 * Uses readonly arrays to match domain types
 */
export const EmpiricalStructureSchema = z.object({
  evidence: z.array(EvidenceSchema).min(1).readonly(),
  claim: z.string().min(1),
  methodology: z.string().optional(),
}).readonly();

/**
 * Union of all argument structures
 */
export const ArgumentStructureSchema = z.union([
  DeductiveStructureSchema,
  InductiveStructureSchema,
  EmpiricalStructureSchema,
]);

/**
 * Argument content schema
 * Marked readonly to match domain types
 */
export const ArgumentContentSchema = z.object({
  text: z.string().min(1),
  structure: ArgumentStructureSchema,
}).readonly();

/**
 * Argument metadata schema
 * Marked readonly to match domain types
 */
export const ArgumentMetadataSchema = z.object({
  hash: z.string().min(1),
  shortHash: z.string().min(1),
  sequenceNumber: z.number().int().min(0),
}).readonly();

/**
 * Base argument data schema (stored in object storage)
 * Uses readonly arrays and objects to match domain types
 */
export const ArgumentDataSchema = z.object({
  id: ArgumentIdSchema,
  agentId: AgentIdSchema,
  type: z.enum(['deductive', 'inductive', 'empirical']),
  content: ArgumentContentSchema,
  timestamp: TimestampSchema,
  simulationId: SimulationIdSchema,
  metadata: ArgumentMetadataSchema,
  citationIds: z.array(z.string()).readonly().optional(),
  // Rebuttal fields
  targetArgumentId: ArgumentIdSchema.optional(),
  rebuttalType: z.enum(['logical', 'empirical', 'methodological']).optional(),
  // Concession fields
  concessionType: z.enum(['full', 'partial', 'conditional']).optional(),
  conditions: z.string().optional(),
  explanation: z.string().optional(),
});

export type ArgumentData = z.infer<typeof ArgumentDataSchema>;

// =============================================================================
// Simulation Schemas
// =============================================================================

/**
 * Close vote schema
 */
export const CloseVoteDataSchema = z.object({
  agentId: AgentIdSchema,
  vote: z.boolean(),
  reason: z.string().optional(),
  timestamp: TimestampSchema,
});

/**
 * Simulation data schema (stored in object storage)
 */
export const SimulationDataSchema = z.object({
  id: SimulationIdSchema,
  topic: z.string().min(1).max(500),
  createdAt: TimestampSchema,
  status: z.enum(['active', 'voting', 'closed']),
  participantIds: z.array(AgentIdSchema),
  argumentIds: z.array(ArgumentIdSchema),
  votesToClose: z.array(CloseVoteDataSchema),
});

export type SimulationData = z.infer<typeof SimulationDataSchema>;

// =============================================================================
// Citation Schemas
// =============================================================================

/**
 * Citation data schema (stored in object storage)
 * ARCHITECTURE: Matches FileCitationRepository save format exactly
 * Type enum values match CitationType domain enum
 */
export const CitationDataSchema = z.object({
  id: CitationIdSchema,
  source: z.string().min(1),
  type: z.enum(['paper', 'report', 'book', 'website', 'study']),
  createdAt: TimestampSchema,
  simulationId: SimulationIdSchema,
  // Optional citation metadata fields
  doi: z.string().optional(),
  url: z.string().url().optional(),
  page: z.number().int().positive().optional(),
  quote: z.string().optional(),
  authors: z.array(z.string()).optional(),
  year: z.number().int().positive().optional(),
});

export type CitationData = z.infer<typeof CitationDataSchema>;

// =============================================================================
// Agent Schemas
// =============================================================================

/**
 * Agent data schema
 */
export const AgentDataSchema = z.object({
  id: AgentIdSchema,
  name: z.string().min(1),
  type: z.enum(['llm', 'human', 'hybrid']),
  description: z.string().optional(),
  capabilities: z.array(z.string()),
  model: z.string().optional(),
  instructions: z.string().optional(),
  filePath: z.string().optional(),
});

export type AgentData = z.infer<typeof AgentDataSchema>;

// =============================================================================
// Parsing Utilities
// =============================================================================

/**
 * Parse unknown data using a Zod schema, returning a Result type.
 * This is the main entry point for parsing storage data.
 *
 * @example
 * const parsed = parseStorageData(ArgumentDataSchema, rawData, 'argument');
 * if (parsed.isErr()) {
 *   return err(parsed.error);
 * }
 * const argumentData = parsed.value;
 */
export function parseStorageData<T>(
  schema: z.ZodType<T>,
  data: unknown,
  dataType: string
): Result<T, StorageError> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const issues = result.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    return err(new StorageError(
      `Invalid ${dataType} data: ${issues}`,
      'parse'
    ));
  }

  return ok(result.data);
}

/**
 * Parse an array of items using a Zod schema
 */
export function parseStorageArray<T>(
  schema: z.ZodType<T>,
  data: unknown[],
  dataType: string
): Result<T[], StorageError> {
  const results: T[] = [];

  for (let i = 0; i < data.length; i++) {
    const parsed = parseStorageData(schema, data[i], `${dataType}[${i}]`);
    if (parsed.isErr()) {
      return err(parsed.error);
    }
    results.push(parsed.value);
  }

  return ok(results);
}

/**
 * Type guard for checking if an object has the expected shape
 * before attempting to parse. Useful for performance optimization.
 */
export function hasRequiredFields(
  data: unknown,
  fields: string[]
): data is Record<string, unknown> {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const record = data as Record<string, unknown>;
  return fields.every(field => field in record);
}
