/**
 * ARCHITECTURE: Infrastructure implementation of simulation repository
 * Pattern: Repository with reference management (Git-like HEAD)
 * Rationale: Enforces single active debate constraint via filesystem
 */

import { injectable, inject } from 'tsyringe';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Result, ok, err, propagateError } from '../../shared/result';
import { NotFoundError, StorageError, ConflictError } from '../../shared/errors';
import type { IDebateRepository } from '../../simulations/debate/repositories/IDebateRepository';
import {
  DebateSimulation,
  CloseVote,
  parseDebateStatus,
  ArgumentId,
  ArgumentIdGenerator,
} from '../../simulations/debate';
import { SimulationId, SimulationIdGenerator } from '../../core/value-objects/SimulationId';
import { TimestampGenerator } from '../../core/value-objects/Timestamp';
import { AgentId, AgentIdGenerator } from '../../core/value-objects/AgentId';
import { ObjectStorage } from './ObjectStorage';
import { TOKENS } from '../../shared/container';
import { hasErrorCode } from './NodeSystemError';
import { SimulationDataSchema, type SimulationData, parseStorageData } from './schemas';

@injectable()
export class FileSimulationRepository implements IDebateRepository {
  private readonly basePath: string;

  constructor(
    @inject(TOKENS.ObjectStorage) private readonly storage: ObjectStorage,
    basePath: string = '.townhall'
  ) {
    this.basePath = basePath;
  }

  public async save(simulation: DebateSimulation): Promise<Result<SimulationId, StorageError>> {
    const data: SimulationData = {
      id: simulation.id,
      topic: simulation.topic,
      createdAt: simulation.createdAt,
      status: simulation.status,
      participantIds: [...simulation.participantIds],
      argumentIds: [...simulation.argumentIds],
      votesToClose: [...simulation.votesToClose],
    };

    const result = await this.storage.store('simulations', data as unknown as Record<string, unknown>);
    if (result.isErr()) {
      return propagateError(result);
    }

    return ok(simulation.id);
  }

  public async findById(id: SimulationId): Promise<Result<DebateSimulation, NotFoundError | StorageError>> {
    const result = await this.storage.retrieve('simulations', id);
    if (result.isErr()) {
      return err(new NotFoundError('Simulation', id));
    }

    return this.deserializeSimulation(result.value.data);
  }

  public async getActive(): Promise<Result<DebateSimulation, NotFoundError | StorageError>> {
    try {
      const headPath = join(this.basePath, 'refs', 'HEAD');
      const activeId = await fs.readFile(headPath, 'utf8');
      return this.findById(activeId.trim() as SimulationId);
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        return err(new NotFoundError('Active Simulation', 'HEAD'));
      }
      return err(new NotFoundError('Active Simulation', `HEAD: ${(error as Error).message}`));
    }
  }

  public async setActive(id: SimulationId): Promise<Result<void, NotFoundError | StorageError | ConflictError>> {
    // Verify simulation exists
    const existsResult = await this.storage.exists('simulations', id);
    if (existsResult.isErr()) {
      return propagateError(existsResult);
    }

    if (!existsResult.value) {
      return err(new NotFoundError('Simulation', id));
    }

    // Check if another simulation is already active
    const hasActiveResult = await this.hasActive();
    if (hasActiveResult.isErr()) {
      return propagateError(hasActiveResult);
    }

    if (hasActiveResult.value) {
      return err(new ConflictError('Another debate is already active'));
    }

    try {
      const refsDir = join(this.basePath, 'refs');
      await fs.mkdir(refsDir, { recursive: true });

      const headPath = join(refsDir, 'HEAD');
      await fs.writeFile(headPath, id, 'utf8');
      return ok(undefined);
    } catch (error) {
      return err(new StorageError(
        `Failed to set active simulation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'write'
      ));
    }
  }

  public async switchActive(id: SimulationId): Promise<Result<void, NotFoundError | StorageError>> {
    // Verify simulation exists
    const existsResult = await this.storage.exists('simulations', id);
    if (existsResult.isErr()) {
      return propagateError(existsResult);
    }

    if (!existsResult.value) {
      return err(new NotFoundError('Simulation', id));
    }

    // Overwrite HEAD without checking for conflicts (this is checkout behavior)
    try {
      const refsDir = join(this.basePath, 'refs');
      await fs.mkdir(refsDir, { recursive: true });

      const headPath = join(refsDir, 'HEAD');
      await fs.writeFile(headPath, id, 'utf8');
      return ok(undefined);
    } catch (error) {
      return err(new StorageError(
        `Failed to switch active simulation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'write'
      ));
    }
  }

  public async hasActive(): Promise<Result<boolean, StorageError>> {
    try {
      const headPath = join(this.basePath, 'refs', 'HEAD');
      await fs.access(headPath);

      // Check if the referenced simulation still exists
      const activeId = await fs.readFile(headPath, 'utf8');
      const existsResult = await this.storage.exists('simulations', activeId.trim());

      if (existsResult.isErr()) {
        return existsResult;
      }

      return ok(existsResult.value);
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        return ok(false);
      }
      return err(new StorageError(
        `Failed to check active simulation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'read'
      ));
    }
  }

  public async clearActive(): Promise<Result<void, StorageError>> {
    try {
      const headPath = join(this.basePath, 'refs', 'HEAD');
      await fs.unlink(headPath);
      return ok(undefined);
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        return ok(undefined); // Already cleared
      }
      return err(new StorageError(
        `Failed to clear active simulation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'write'
      ));
    }
  }

  public async listAll(): Promise<Result<DebateSimulation[], StorageError>> {
    const listResult = await this.storage.list('simulations');
    if (listResult.isErr()) {
      return propagateError(listResult);
    }

    // PERFORMANCE: Fetch all simulations in parallel instead of sequentially
    const retrievePromises = listResult.value.map(id =>
      this.storage.retrieve('simulations', id)
    );
    const results = await Promise.all(retrievePromises);

    const simulations: DebateSimulation[] = [];
    for (const simResult of results) {
      if (simResult.isOk()) {
        const deserializeResult = this.deserializeSimulation(simResult.value.data);
        if (deserializeResult.isErr()) {
          return propagateError(deserializeResult);
        }
        simulations.push(deserializeResult.value);
      }
    }

    return ok(simulations);
  }

  public async exists(id: SimulationId): Promise<Result<boolean, StorageError>> {
    return this.storage.exists('simulations', id);
  }

  public async delete(id: SimulationId): Promise<Result<void, StorageError>> {
    // Clear active reference if this was the active simulation
    const activeResult = await this.getActive();
    if (activeResult.isOk() && activeResult.value.id === id) {
      const clearResult = await this.clearActive();
      if (clearResult.isErr()) {
        return clearResult;
      }
    }

    return this.storage.delete('simulations', id);
  }

  /**
   * Deserializes simulation data from storage
   * ARCHITECTURE: Uses Zod for schema validation at storage boundary
   * Pattern: Parse, don't validate - validates shape before domain logic
   * Returns Result to allow callers to handle corruption gracefully
   */
  private deserializeSimulation(rawData: unknown): Result<DebateSimulation, StorageError> {
    // STEP 1: Schema validation with Zod (parse, don't validate)
    const parseResult = parseStorageData(SimulationDataSchema, rawData, 'simulation');
    if (parseResult.isErr()) {
      return propagateError(parseResult);
    }
    const data = parseResult.value;

    // STEP 2: Domain validation - Validate SimulationId format
    const idResult = SimulationIdGenerator.fromHash(data.id);
    if (idResult.isErr()) {
      return err(new StorageError(
        `Invalid simulation ID '${data.id}': ${idResult.error.message}`,
        'deserialize'
      ));
    }

    // Domain validation: Validate Timestamp format
    const timestampResult = TimestampGenerator.fromString(data.createdAt);
    if (timestampResult.isErr()) {
      return err(new StorageError(
        `Invalid timestamp '${data.createdAt}': ${timestampResult.error.message}`,
        'deserialize'
      ));
    }

    // Domain validation: Validate DebateStatus
    const statusResult = parseDebateStatus(data.status);
    if (statusResult.isErr()) {
      return err(new StorageError(
        `Invalid status '${data.status}': ${statusResult.error.message}`,
        'deserialize'
      ));
    }

    // Domain validation: Validate participant IDs (UUID format)
    const validatedParticipantIds: AgentId[] = [];
    for (const participantId of data.participantIds) {
      const result = AgentIdGenerator.fromString(participantId);
      if (result.isErr()) {
        return err(new StorageError(
          `Invalid participant ID '${participantId}': ${result.error.message}`,
          'deserialize'
        ));
      }
      validatedParticipantIds.push(result.value);
    }

    // Domain validation: Validate argument IDs (SHA-256 hash format)
    const validatedArgumentIds: ArgumentId[] = [];
    for (const argumentId of data.argumentIds) {
      const result = ArgumentIdGenerator.fromHash(argumentId);
      if (result.isErr()) {
        return err(new StorageError(
          `Invalid argument ID '${argumentId}': ${result.error.message}`,
          'deserialize'
        ));
      }
      validatedArgumentIds.push(result.value);
    }

    // Reconstitute with validated data
    const reconstituteResult = DebateSimulation.reconstitute(
      idResult.value,
      data.topic,
      timestampResult.value,
      statusResult.value,
      validatedParticipantIds,
      validatedArgumentIds,
      data.votesToClose as CloseVote[]
    );

    // Map domain validation errors to StorageError
    if (reconstituteResult.isErr()) {
      return err(new StorageError(
        `Failed to deserialize simulation: ${reconstituteResult.error.message}`,
        'deserialize'
      ));
    }

    return ok(reconstituteResult.value);
  }
}