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
import { SimulationId } from '../../core/value-objects/SimulationId';
import { CitationType } from '../../core/value-objects/CitationType';
import { Timestamp, TimestampGenerator } from '../../core/value-objects/Timestamp';
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
      simulationId: SimulationId.toString(simulationId),
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
    const simIdString = SimulationId.toString(simulationId);

    // List all citations
    const listResult = await this.storage.list('citations');
    if (listResult.isErr()) {
      return err(new CitationStorageError(listResult.error.message, 'list'));
    }

    const citationIds = listResult.value;
    const citations: Citation[] = [];

    // Fetch each citation and filter by simulation
    for (const citationId of citationIds) {
      const retrieveResult = await this.storage.retrieve('citations', citationId);
      if (retrieveResult.isOk()) {
        const data = retrieveResult.value.data as unknown as CitationData;
        if (data.simulationId === simIdString) {
          citations.push(this.deserialize(data));
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
