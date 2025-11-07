/**
 * ARCHITECTURE: Infrastructure implementation of citation repository
 * Pattern: Repository implementation using object storage
 * Rationale: Implements core interface with file-based persistence
 */

import { injectable, inject } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { ICitationRepository, CitationStorageError, CitationNotFoundError, CitationResolutionError } from '../../core/repositories/ICitationRepository';
import { Citation } from '../../core/entities/Citation';
import { CitationId } from '../../core/value-objects/CitationId';
import type { SimulationId } from '../../core/value-objects/SimulationId';
import { CitationType } from '../../core/value-objects/CitationType';
import type { Timestamp } from '../../core/value-objects/Timestamp';
import { TimestampGenerator } from '../../core/value-objects/Timestamp';
import { ObjectStorage } from './ObjectStorage';
import { HashResolver } from './HashResolver';
import { TOKENS } from '../../shared/container';

interface CitationData {
  readonly id: string;
  readonly source: string;
  readonly type: CitationType;
  readonly doi?: string;
  readonly url?: string;
  readonly page?: number;
  readonly quote?: string;
  readonly authors?: string[];
  readonly year?: number;
  readonly createdAt: string;
  readonly simulationId: string;
}

@injectable()
export class FileCitationRepository implements ICitationRepository {
  constructor(
    @inject(TOKENS.ObjectStorage) private readonly storage: ObjectStorage,
    @inject(TOKENS.HashResolver) private readonly hashResolver: HashResolver
  ) {}

  public async save(citation: Citation, simulationId: SimulationId): Promise<Result<CitationId, CitationStorageError>> {
    const data: CitationData = {
      id: CitationId.toString(citation.id),
      source: citation.source,
      type: citation.type,
      doi: citation.metadata.doi,
      url: citation.metadata.url,
      page: citation.metadata.page,
      quote: citation.metadata.quote,
      authors: citation.metadata.authors,
      year: citation.metadata.year,
      createdAt: citation.createdAt,
      simulationId: simulationId as string,
    };

    const result = await this.storage.store('citations', data as Record<string, unknown>);
    if (result.isErr()) {
      return err(new CitationStorageError(result.error.message, 'save'));
    }

    return ok(citation.id);
  }

  public async findById(id: CitationId): Promise<Result<Citation, CitationNotFoundError>> {
    const idString = CitationId.toString(id);
    const result = await this.storage.retrieve('citations', idString);

    if (result.isErr()) {
      return err(new CitationNotFoundError(idString));
    }

    const data = result.value.data as unknown as CitationData;
    const citation = this.deserialize(data);
    return ok(citation);
  }

  public async findBySimulation(simulationId: SimulationId): Promise<Result<Citation[], CitationStorageError>> {
    const simIdString = simulationId as string;

    // List all citations
    const listResult = await this.storage.list('citations');
    if (listResult.isErr()) {
      return err(new CitationStorageError(listResult.error.message, 'list'));
    }

    const citationIds = listResult.value;

    // Fetch all citations in parallel
    const retrievePromises = citationIds.map(citationId =>
      this.storage.retrieve('citations', citationId)
    );

    const retrieveResults = await Promise.all(retrievePromises);

    // Filter by simulation ID and deserialize
    const citations: Citation[] = retrieveResults
      .filter(result => result.isOk())
      .map(result => result.value.data as unknown as CitationData)
      .filter(data => data.simulationId === simIdString)
      .map(data => this.deserialize(data));

    return ok(citations);
  }

  public async findByType(
    simulationId: SimulationId,
    type: CitationType
  ): Promise<Result<Citation[], CitationStorageError>> {
    const allCitationsResult = await this.findBySimulation(simulationId);
    if (allCitationsResult.isErr()) {
      return allCitationsResult;
    }

    const filtered = allCitationsResult.value.filter(citation => citation.type === type);
    return ok(filtered);
  }

  public async getUsageCount(id: CitationId): Promise<Result<number, CitationStorageError>> {
    const idString = CitationId.toString(id);

    // List all arguments to count references
    const listResult = await this.storage.list('arguments');
    if (listResult.isErr()) {
      return err(new CitationStorageError(listResult.error.message, 'list'));
    }

    let usageCount = 0;
    const argumentIds = listResult.value;

    // Check each argument for citation references
    for (const argId of argumentIds) {
      const retrieveResult = await this.storage.retrieve('arguments', argId);
      if (retrieveResult.isOk()) {
        const argData = retrieveResult.value.data as Record<string, unknown>;
        const citationRefs = argData.citationIds as string[] | undefined;

        if (citationRefs && citationRefs.includes(idString)) {
          usageCount++;
        }
      }
    }

    return ok(usageCount);
  }

  public async getUsageCountsBatch(ids: readonly CitationId[]): Promise<Result<Map<CitationId, number>, CitationStorageError>> {
    // List all arguments once for efficiency
    const listResult = await this.storage.list('arguments');
    if (listResult.isErr()) {
      return err(new CitationStorageError(listResult.error.message, 'list'));
    }

    const argumentIds = listResult.value;

    // Initialize usage map with zeros
    const usageCounts = new Map<CitationId, number>();
    for (const id of ids) {
      usageCounts.set(id, 0);
    }

    // Convert citation IDs to strings for comparison
    const idStrings = new Set(ids.map(id => CitationId.toString(id)));

    // Fetch all arguments in parallel
    const retrievePromises = argumentIds.map(argId =>
      this.storage.retrieve('arguments', argId)
    );
    const retrieveResults = await Promise.all(retrievePromises);

    // Count citations across all arguments
    for (const result of retrieveResults) {
      if (result.isOk()) {
        const argData = result.value.data as Record<string, unknown>;
        const citationRefs = argData.citationIds as string[] | undefined;

        if (citationRefs) {
          for (const citationRef of citationRefs) {
            if (idStrings.has(citationRef)) {
              // Find the CitationId that matches this string
              const matchingId = ids.find(id => CitationId.toString(id) === citationRef);
              if (matchingId) {
                usageCounts.set(matchingId, (usageCounts.get(matchingId) || 0) + 1);
              }
            }
          }
        }
      }
    }

    return ok(usageCounts);
  }

  /**
   * Resolve short citation ID to full ID (git-style short hash resolution)
   *
   * Behavior:
   * - Minimum 7 characters required (git standard)
   * - Prefix matching: Finds citation IDs starting with the short ID
   * - Returns error if no matches found (not_found)
   * - Returns error if multiple citations match (ambiguous)
   * - Returns full 64-character ID if exactly one match
   *
   * Edge cases:
   * - Empty string: Returns 'too_short' error
   * - 1-6 characters: Returns 'too_short' error
   * - No matches: Returns 'not_found' error
   * - Multiple matches: Returns 'ambiguous' error (user should provide longer ID)
   * - Case sensitivity: SHA-256 hashes are lowercase hex, comparison is case-sensitive
   * - Full ID provided (64 chars): Also works, just returns same ID
   *
   * Performance: O(n) where n = total citations (scans all citation IDs)
   * With typical workloads (< 1000 citations), this is acceptable.
   *
   * @param shortId - Short citation ID (minimum 7 characters, hex string)
   * @returns Full CitationId if unique match found, CitationResolutionError otherwise
   */
  public async resolveShortId(shortId: string): Promise<Result<CitationId, CitationResolutionError>> {
    // Validate minimum length
    if (shortId.length < 7) {
      return err(new CitationResolutionError(shortId, 'too_short'));
    }

    // Use hash resolver to find full ID
    const resolveResult = await this.hashResolver.resolveShortHash(shortId, 'citations');

    if (resolveResult.isErr()) {
      const error = resolveResult.error;
      if (error.name === 'NotFoundError') {
        return err(new CitationResolutionError(shortId, 'not_found'));
      } else if (error.name === 'ConflictError') {
        return err(new CitationResolutionError(shortId, 'ambiguous'));
      }
      return err(new CitationResolutionError(shortId, 'not_found'));
    }

    const fullId = resolveResult.value;
    return ok(CitationId.fromString(fullId));
  }

  private deserialize(data: CitationData): Citation {
    return Citation.reconstitute(
      CitationId.fromString(data.id),
      data.source,
      data.type,
      {
        doi: data.doi,
        url: data.url,
        page: data.page,
        quote: data.quote,
        authors: data.authors,
        year: data.year,
      },
      data.createdAt as Timestamp
    );
  }
}
