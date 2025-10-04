/**
 * ARCHITECTURE: Infrastructure implementation of argument repository
 * Pattern: Repository implementation using object storage
 * Rationale: Implements core interface with file-based persistence
 */

import { injectable, inject } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { NotFoundError, StorageError } from '../../shared/errors';
import { IArgumentRepository } from '../../core/repositories/IArgumentRepository';
import { Argument } from '../../core/entities/Argument';
import { Rebuttal } from '../../core/entities/Rebuttal';
import { Concession } from '../../core/entities/Concession';
import { ArgumentId, ArgumentIdGenerator } from '../../core/value-objects/ArgumentId';
import { SimulationId } from '../../core/value-objects/SimulationId';
import { AgentId } from '../../core/value-objects/AgentId';
import { ObjectStorage } from './ObjectStorage';
import { TOKENS } from '../../shared/container';

interface ArgumentData {
  readonly id: string;
  readonly agentId: string;
  readonly type: string;
  readonly content: any;
  readonly timestamp: string;
  readonly simulationId: string;
  readonly metadata: any;
  readonly targetArgumentId?: string; // For rebuttals/concessions
  readonly rebuttalType?: string;
  readonly concessionType?: string;
  readonly conditions?: string;
  readonly explanation?: string;
}

@injectable()
export class FileArgumentRepository implements IArgumentRepository {
  constructor(
    @inject(TOKENS.ObjectStorage) private readonly storage: ObjectStorage
  ) {}

  public async save(argument: Argument): Promise<Result<ArgumentId, StorageError>> {
    const data: ArgumentData = {
      id: argument.id,
      agentId: argument.agentId,
      type: argument.type,
      content: argument.content,
      timestamp: argument.timestamp,
      simulationId: argument.simulationId,
      metadata: argument.metadata,
    };

    const result = await this.storage.store('arguments', data);
    if (result.isErr()) {
      return result;
    }

    return ok(argument.id);
  }

  public async saveRebuttal(rebuttal: Rebuttal): Promise<Result<ArgumentId, StorageError>> {
    const data: ArgumentData = {
      id: rebuttal.id,
      agentId: rebuttal.agentId,
      type: rebuttal.type,
      content: rebuttal.content,
      timestamp: rebuttal.timestamp,
      simulationId: rebuttal.simulationId,
      metadata: rebuttal.metadata,
      targetArgumentId: rebuttal.targetArgumentId,
      rebuttalType: rebuttal.rebuttalType,
    };

    const result = await this.storage.store('arguments', data);
    if (result.isErr()) {
      return result;
    }

    return ok(rebuttal.id);
  }

  public async saveConcession(concession: Concession): Promise<Result<ArgumentId, StorageError>> {
    const data: ArgumentData = {
      id: concession.id,
      agentId: concession.agentId,
      type: concession.type,
      content: concession.content,
      timestamp: concession.timestamp,
      simulationId: concession.simulationId,
      metadata: concession.metadata,
      targetArgumentId: concession.targetArgumentId,
      concessionType: concession.concessionType,
      conditions: concession.conditions,
      explanation: concession.explanation,
    };

    const result = await this.storage.store('arguments', data);
    if (result.isErr()) {
      return result;
    }

    return ok(concession.id);
  }

  public async findById(id: ArgumentId | string): Promise<Result<Argument, NotFoundError>> {
    let argumentId: string;

    if (typeof id === 'string') {
      if (id.length === 64) {
        argumentId = id;
      } else {
        // Try to expand short hash
        const expandResult = await this.expandShortHash(id);
        if (expandResult.isErr()) {
          return err(new NotFoundError('Argument', id));
        }
        argumentId = expandResult.value;
      }
    } else {
      argumentId = id;
    }

    const result = await this.storage.retrieve('arguments', argumentId);
    if (result.isErr()) {
      return err(new NotFoundError('Argument', argumentId));
    }

    return ok(this.deserializeArgument(result.value.data as ArgumentData));
  }

  public async findBySimulation(simulationId: SimulationId): Promise<Result<Argument[], StorageError>> {
    const listResult = await this.storage.list('arguments');
    if (listResult.isErr()) {
      return listResult;
    }

    // PERFORMANCE: Fetch all arguments in parallel instead of sequentially
    const retrievePromises = listResult.value.map(id =>
      this.storage.retrieve('arguments', id)
    );
    const results = await Promise.all(retrievePromises);

    const argumentList: Argument[] = [];
    for (const argResult of results) {
      if (argResult.isOk()) {
        const data = argResult.value.data as ArgumentData;
        if (data.simulationId === simulationId) {
          argumentList.push(this.deserializeArgument(data));
        }
      }
    }

    return ok(argumentList);
  }

  public async findByAgent(agentId: AgentId): Promise<Result<Argument[], StorageError>> {
    const listResult = await this.storage.list('arguments');
    if (listResult.isErr()) {
      return listResult;
    }

    // PERFORMANCE: Fetch all arguments in parallel instead of sequentially
    const retrievePromises = listResult.value.map(id =>
      this.storage.retrieve('arguments', id)
    );
    const results = await Promise.all(retrievePromises);

    const argumentList: Argument[] = [];
    for (const argResult of results) {
      if (argResult.isOk()) {
        const data = argResult.value.data as ArgumentData;
        if (data.agentId === agentId) {
          argumentList.push(this.deserializeArgument(data));
        }
      }
    }

    return ok(argumentList);
  }

  public async findReferencingArguments(targetId: ArgumentId): Promise<Result<Argument[], StorageError>> {
    const listResult = await this.storage.list('arguments');
    if (listResult.isErr()) {
      return listResult;
    }

    // PERFORMANCE: Fetch all arguments in parallel instead of sequentially
    const retrievePromises = listResult.value.map(id =>
      this.storage.retrieve('arguments', id)
    );
    const results = await Promise.all(retrievePromises);

    const argumentList: Argument[] = [];
    for (const argResult of results) {
      if (argResult.isOk()) {
        const data = argResult.value.data as ArgumentData;
        if (data.targetArgumentId === targetId) {
          argumentList.push(this.deserializeArgument(data));
        }
      }
    }

    return ok(argumentList);
  }

  public async exists(id: ArgumentId): Promise<Result<boolean, StorageError>> {
    return this.storage.exists('arguments', id);
  }

  public async expandShortHash(shortHash: string): Promise<Result<ArgumentId, NotFoundError>> {
    const listResult = await this.storage.list('arguments');
    if (listResult.isErr()) {
      return err(new NotFoundError('Argument', shortHash));
    }

    const matches = listResult.value.filter(id => id.startsWith(shortHash));

    if (matches.length === 0) {
      return err(new NotFoundError('Argument', shortHash));
    }

    if (matches.length > 1) {
      return err(new NotFoundError('Argument', `${shortHash} (ambiguous - multiple matches)`));
    }

    return ok(matches[0]! as ArgumentId);
  }

  public async getAllIds(simulationId: SimulationId): Promise<Result<ArgumentId[], StorageError>> {
    const argumentsResult = await this.findBySimulation(simulationId);
    if (argumentsResult.isErr()) {
      return argumentsResult;
    }

    const ids = argumentsResult.value.map(arg => arg.id);
    return ok(ids);
  }

  public async findRelationships(argumentId: ArgumentId): Promise<Result<{
    rebuttals: ArgumentId[];
    concessions: ArgumentId[];
    supports: ArgumentId[];
  }, StorageError>> {
    const referencingResult = await this.findReferencingArguments(argumentId);
    if (referencingResult.isErr()) {
      return referencingResult;
    }

    const relationships = {
      rebuttals: [] as ArgumentId[],
      concessions: [] as ArgumentId[],
      supports: [] as ArgumentId[],
    };

    for (const arg of referencingResult.value) {
      // Check if it's a rebuttal or concession based on type
      // For simplicity, treating all as rebuttals for now
      // In a real implementation, we'd check the argument type
      relationships.rebuttals.push(arg.id);
    }

    return ok(relationships);
  }

  /**
   * Detects the argument type from stored data
   * Complexity: 2 (simple conditional)
   */
  private detectArgumentType(data: ArgumentData): 'argument' | 'rebuttal' | 'concession' {
    if (data.rebuttalType) return 'rebuttal';
    if (data.concessionType) return 'concession';
    return 'argument';
  }

  /**
   * Creates an Argument from stored data
   */
  private deserializeBaseArgument(data: ArgumentData): Result<Argument, Error> {
    return Argument.create({
      agentId: data.agentId as AgentId,
      type: data.type as any,
      content: data.content,
      simulationId: data.simulationId as SimulationId,
      timestamp: data.timestamp as any,
      sequenceNumber: data.metadata.sequenceNumber,
    });
  }

  /**
   * Creates a Rebuttal from stored data
   */
  private deserializeRebuttal(data: ArgumentData): Result<Rebuttal, Error> {
    return Rebuttal.create({
      agentId: data.agentId as AgentId,
      type: data.type as any,
      content: data.content,
      simulationId: data.simulationId as SimulationId,
      timestamp: data.timestamp as any,
      targetArgumentId: data.targetArgumentId as ArgumentId,
      rebuttalType: data.rebuttalType as any,
    });
  }

  /**
   * Creates a Concession from stored data
   */
  private deserializeConcession(data: ArgumentData): Result<Concession, Error> {
    return Concession.create({
      agentId: data.agentId as AgentId,
      type: data.type as any,
      content: data.content,
      simulationId: data.simulationId as SimulationId,
      timestamp: data.timestamp as any,
      targetArgumentId: data.targetArgumentId as ArgumentId,
      concessionType: data.concessionType as any,
      conditions: data.conditions,
      explanation: data.explanation,
    });
  }

  /**
   * Deserializes argument data from storage
   * REFACTORED: Reduced complexity from 9 to 3 using strategy pattern
   * Complexity: 3 (type detection + error check + return)
   */
  private deserializeArgument(data: ArgumentData): Argument {
    // Strategy pattern: Use lookup table instead of nested conditionals
    const deserializers = {
      argument: (d: ArgumentData) => this.deserializeBaseArgument(d),
      rebuttal: (d: ArgumentData) => this.deserializeRebuttal(d),
      concession: (d: ArgumentData) => this.deserializeConcession(d),
    };

    const type = this.detectArgumentType(data);
    const result = deserializers[type](data);

    // SAFETY: Deserialization from trusted storage should always succeed
    // If it fails, it indicates data corruption - throw to surface the issue
    if (result.isErr()) {
      throw new Error(`Data corruption: Failed to deserialize ${type} - ${result.error.message}`);
    }

    return result.value;
  }
}