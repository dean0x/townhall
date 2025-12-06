/**
 * ICitationRepository - Port for citation persistence
 *
 * Defines the contract for citation storage operations.
 * Implementations in infrastructure layer (e.g., FileCitationRepository).
 */

import { Result } from '../../shared/result';
import { Citation } from '../entities/Citation';
import { CitationId } from '../value-objects/CitationId';
import { SimulationId } from '../value-objects/SimulationId';
import { CitationType } from '../value-objects/CitationType';

/**
 * Repository interface for Citation entities
 */
export interface ICitationRepository {
  /**
   * Save a citation to storage
   *
   * @param citation - The citation to save
   * @param simulationId - The simulation this citation belongs to
   * @returns Result containing the citation ID or storage error
   */
  save(citation: Citation, simulationId: SimulationId): Promise<Result<CitationId, CitationStorageError>>;

  /**
   * Find a citation by its ID
   *
   * @param id - The citation ID to find
   * @returns Result containing the citation, not found error, or storage error if data is corrupted
   */
  findById(id: CitationId): Promise<Result<Citation, CitationNotFoundError | CitationStorageError>>;

  /**
   * Find all citations in a simulation
   *
   * @param simulationId - The simulation ID
   * @returns Result containing array of citations or storage error
   */
  findBySimulation(simulationId: SimulationId): Promise<Result<Citation[], CitationStorageError>>;

  /**
   * Find citations by type within a simulation
   *
   * @param simulationId - The simulation ID
   * @param type - The citation type to filter by
   * @returns Result containing filtered citations or storage error
   */
  findByType(
    simulationId: SimulationId,
    type: CitationType
  ): Promise<Result<Citation[], CitationStorageError>>;

  /**
   * Get usage statistics for a citation
   *
   * @param id - The citation ID
   * @returns Result containing usage count or storage error
   */
  getUsageCount(id: CitationId): Promise<Result<number, CitationStorageError>>;

  /**
   * Get usage statistics for multiple citations in batch
   * More efficient than calling getUsageCount multiple times
   *
   * @param ids - Array of citation IDs to get usage counts for
   * @returns Result containing map of citation IDs to usage counts
   */
  getUsageCountsBatch(ids: readonly CitationId[]): Promise<Result<Map<CitationId, number>, CitationStorageError>>;

  /**
   * Resolve short citation ID to full ID
   * Similar to git's short hash resolution
   *
   * @param shortId - Short citation ID (minimum 7 characters)
   * @returns Result containing full citation ID or resolution error
   */
  resolveShortId(shortId: string): Promise<Result<CitationId, CitationResolutionError>>;
}

/**
 * Error when citation storage operation fails
 *
 * Common causes:
 * - File system permission errors (read/write access)
 * - Disk space exhaustion
 * - Concurrent write conflicts
 * - Malformed data during deserialization
 *
 * @example
 * ```typescript
 * const result = await citationRepo.save(citation, simulationId);
 * if (result.isErr()) {
 *   const error = result.error; // CitationStorageError
 *   logger.error('Storage operation failed', {
 *     operation: error.operation, // 'save', 'list', 'retrieve'
 *     message: error.message,
 *   });
 * }
 * ```
 */
export class CitationStorageError extends Error {
  constructor(
    message: string,
    /** The storage operation that failed (save, list, retrieve, etc.) */
    public readonly operation: string
  ) {
    super(message);
    this.name = 'CitationStorageError';
  }
}

/**
 * Error when citation is not found by ID
 *
 * Occurs when:
 * - Citation ID doesn't exist in storage
 * - Citation was deleted
 * - Using wrong simulation context
 *
 * @example
 * ```typescript
 * const result = await citationRepo.findById(citationId);
 * if (result.isErr()) {
 *   // User provided invalid citation ID
 *   console.error(`Citation ${result.error.citationId} not found`);
 * }
 * ```
 */
export class CitationNotFoundError extends Error {
  public readonly code = 'NOT_FOUND';

  constructor(
    /** The citation ID that was not found (full 64-char hash) */
    public readonly citationId: string
  ) {
    super(`Citation not found: ${citationId}`);
    this.name = 'CitationNotFoundError';
  }
}

/**
 * Error when short ID cannot be resolved to full ID
 *
 * Resolution fails when:
 * - 'not_found': No citations match the short ID prefix
 * - 'ambiguous': Multiple citations match (need longer prefix)
 * - 'too_short': Short ID < 7 characters (minimum required)
 *
 * @example
 * ```typescript
 * const result = await citationRepo.resolveShortId('abc1234');
 * if (result.isErr()) {
 *   const error = result.error;
 *   if (error.reason === 'ambiguous') {
 *     console.log('Multiple matches found, provide longer ID');
 *   } else if (error.reason === 'too_short') {
 *     console.log('Minimum 7 characters required');
 *   }
 * }
 * ```
 */
export class CitationResolutionError extends Error {
  constructor(
    /** The short ID that could not be resolved */
    public readonly shortId: string,
    /** Why resolution failed */
    public readonly reason: 'not_found' | 'ambiguous' | 'too_short'
  ) {
    super(`Cannot resolve citation ID ${shortId}: ${reason}`);
    this.name = 'CitationResolutionError';
  }
}
