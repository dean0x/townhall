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
import { TimestampGenerator } from '../../core/value-objects/Timestamp';
import { ObjectStorage } from './ObjectStorage';
import { HashResolver } from './HashResolver';
import { TOKENS } from '../../shared/container';
import { CitationDataSchema, type CitationData, parseStorageData } from './schemas';

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
      createdAt: citation.createdAt,
      simulationId: simulationId as string,
      ...(citation.metadata.doi !== undefined && { doi: citation.metadata.doi }),
      ...(citation.metadata.url !== undefined && { url: citation.metadata.url }),
      ...(citation.metadata.page !== undefined && { page: citation.metadata.page }),
      ...(citation.metadata.quote !== undefined && { quote: citation.metadata.quote }),
      ...(citation.metadata.authors !== undefined && { authors: citation.metadata.authors }),
      ...(citation.metadata.year !== undefined && { year: citation.metadata.year }),
    };

    const result = await this.storage.store('citations', data as unknown as Record<string, unknown>);
    if (result.isErr()) {
      return err(new CitationStorageError(result.error.message, 'save'));
    }

    return ok(citation.id);
  }

  public async findById(id: CitationId): Promise<Result<Citation, CitationNotFoundError | CitationStorageError>> {
    const idString = CitationId.toString(id);
    const result = await this.storage.retrieve('citations', idString);

    if (result.isErr()) {
      return err(new CitationNotFoundError(idString));
    }

    return this.deserialize(result.value.data);
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
    const citations: Citation[] = [];
    for (const result of retrieveResults) {
      if (result.isOk()) {
        const data = result.value.data as Record<string, unknown>;
        if (data.simulationId === simIdString) {
          const deserializeResult = this.deserialize(data);
          if (deserializeResult.isErr()) {
            return err(deserializeResult.error);
          }
          citations.push(deserializeResult.value);
        }
      }
    }

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

  /**
   * Deserializes citation data from storage
   * ARCHITECTURE: Uses Zod for schema validation at storage boundary
   * Pattern: Parse, don't validate - validates shape before domain logic
   * Returns Result to allow callers to handle corruption gracefully
   */
  private deserialize(rawData: unknown): Result<Citation, CitationStorageError> {
    // STEP 1: Schema validation with Zod (parse, don't validate)
    const parseResult = parseStorageData(CitationDataSchema, rawData, 'citation');
    if (parseResult.isErr()) {
      return err(new CitationStorageError(parseResult.error.message, 'deserialize'));
    }
    const data = parseResult.value;

    // STEP 2: Domain validation - Validate Timestamp format
    const timestampResult = TimestampGenerator.fromString(data.createdAt);
    if (timestampResult.isErr()) {
      return err(new CitationStorageError(
        `Invalid timestamp '${data.createdAt}': ${timestampResult.error.message}`,
        'deserialize'
      ));
    }

    // STEP 3: Construct metadata from optional fields
    const metadata = {
      ...(data.doi !== undefined && { doi: data.doi }),
      ...(data.url !== undefined && { url: data.url }),
      ...(data.page !== undefined && { page: data.page }),
      ...(data.quote !== undefined && { quote: data.quote }),
      ...(data.authors !== undefined && { authors: [...data.authors] }),
      ...(data.year !== undefined && { year: data.year }),
    };

    // SAFETY: Cast is safe because Zod enum values match CitationType enum values
    return ok(Citation.reconstitute(
      CitationId.fromString(data.id),
      data.source,
      data.type as CitationType,
      metadata,
      timestampResult.value
    ));
  }
}
