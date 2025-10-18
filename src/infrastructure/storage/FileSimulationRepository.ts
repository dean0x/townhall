/**
 * ARCHITECTURE: Infrastructure implementation of simulation repository
 * Pattern: Repository with reference management (Git-like HEAD)
 * Rationale: Enforces single active debate constraint via filesystem
 */

import { injectable, inject } from 'tsyringe';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Result, ok, err } from '../../shared/result';
import { NotFoundError, StorageError, ConflictError } from '../../shared/errors';
import { ISimulationRepository } from '../../core/repositories/ISimulationRepository';
import { DebateSimulation, CloseVote } from '../../core/entities/DebateSimulation';
import { SimulationId, SimulationIdGenerator } from '../../core/value-objects/SimulationId';
import { Timestamp, TimestampGenerator } from '../../core/value-objects/Timestamp';
import { DebateStatus, parseDebateStatus } from '../../core/value-objects/DebateStatus';
import { AgentId } from '../../core/value-objects/AgentId';
import { ArgumentId } from '../../core/value-objects/ArgumentId';
import { ObjectStorage } from './ObjectStorage';
import { TOKENS } from '../../shared/container';
import { hasErrorCode } from './NodeSystemError';

interface SimulationData {
  readonly id: string;
  readonly topic: string;
  readonly createdAt: string;
  readonly status: string;
  readonly participantIds: string[];
  readonly argumentIds: string[];
  readonly votesToClose: CloseVote[];
}

@injectable()
export class FileSimulationRepository implements ISimulationRepository {
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
      participantIds: simulation.participantIds,
      argumentIds: simulation.argumentIds,
      votesToClose: simulation.votesToClose,
    };

    const result = await this.storage.store('simulations', data);
    if (result.isErr()) {
      return result;
    }

    return ok(simulation.id);
  }

  public async findById(id: SimulationId): Promise<Result<DebateSimulation, NotFoundError>> {
    const result = await this.storage.retrieve('simulations', id);
    if (result.isErr()) {
      return err(new NotFoundError('Simulation', id));
    }

    return ok(this.deserializeSimulation(result.value.data as SimulationData));
  }

  public async getActive(): Promise<Result<DebateSimulation, NotFoundError>> {
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
      return existsResult;
    }

    if (!existsResult.value) {
      return err(new NotFoundError('Simulation', id));
    }

    // Check if another simulation is already active
    const hasActiveResult = await this.hasActive();
    if (hasActiveResult.isErr()) {
      return hasActiveResult;
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
      return existsResult;
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
      return listResult;
    }

    // PERFORMANCE: Fetch all simulations in parallel instead of sequentially
    const retrievePromises = listResult.value.map(id =>
      this.storage.retrieve('simulations', id)
    );
    const results = await Promise.all(retrievePromises);

    const simulations: DebateSimulation[] = [];
    for (const simResult of results) {
      if (simResult.isOk()) {
        simulations.push(this.deserializeSimulation(simResult.value.data as SimulationData));
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

  private deserializeSimulation(data: SimulationData): DebateSimulation {
    // ARCHITECTURE: Runtime validation before type assertions
    // Rationale: Ensure storage data is valid before reconstituting domain entities

    // Validate SimulationId
    const idResult = SimulationIdGenerator.fromHash(data.id);
    if (idResult.isErr()) {
      throw new Error(`Data corruption: Invalid simulation ID '${data.id}' - ${idResult.error.message}`);
    }

    // Validate Timestamp
    const timestampResult = TimestampGenerator.fromString(data.createdAt);
    if (timestampResult.isErr()) {
      throw new Error(`Data corruption: Invalid timestamp '${data.createdAt}' - ${timestampResult.error.message}`);
    }

    // Validate DebateStatus
    const statusResult = parseDebateStatus(data.status);
    if (statusResult.isErr()) {
      throw new Error(`Data corruption: Invalid status '${data.status}' - ${statusResult.error.message}`);
    }

    // Validate participantIds array
    if (!Array.isArray(data.participantIds) || !data.participantIds.every(id => typeof id === 'string')) {
      throw new Error('Data corruption: participantIds must be an array of strings');
    }

    // Validate argumentIds array
    if (!Array.isArray(data.argumentIds) || !data.argumentIds.every(id => typeof id === 'string')) {
      throw new Error('Data corruption: argumentIds must be an array of strings');
    }

    // Reconstitute with validated data
    const result = DebateSimulation.reconstitute(
      idResult.value,
      data.topic,
      timestampResult.value,
      statusResult.value,
      data.participantIds as AgentId[],
      data.argumentIds as ArgumentId[],
      data.votesToClose
    );

    // SAFETY: Deserialization with validated data should always succeed
    // If it still fails, it indicates data corruption - throw to surface the issue
    if (result.isErr()) {
      throw new Error(`Data corruption: Failed to deserialize simulation - ${result.error.message}`);
    }

    return result.value;
  }
}