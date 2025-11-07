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
   * @returns Result containing the citation or not found error
   */
  findById(id: CitationId): Promise<Result<Citation, CitationNotFoundError>>;

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
 */
export class CitationStorageError extends Error {
  constructor(
    message: string,
    public readonly operation: string
  ) {
    super(message);
    this.name = 'CitationStorageError';
  }
}

/**
 * Error when citation is not found
 */
export class CitationNotFoundError extends Error {
  public readonly code = 'NOT_FOUND';

  constructor(
    public readonly citationId: string
  ) {
    super(`Citation not found: ${citationId}`);
    this.name = 'CitationNotFoundError';
  }
}

/**
 * Error when short ID cannot be resolved
 */
export class CitationResolutionError extends Error {
  constructor(
    public readonly shortId: string,
    public readonly reason: 'not_found' | 'ambiguous' | 'too_short'
  ) {
    super(`Cannot resolve citation ID ${shortId}: ${reason}`);
    this.name = 'CitationResolutionError';
  }
}
