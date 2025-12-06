/**
 * ARCHITECTURE: Infrastructure implementation of argument repository
 * Pattern: Repository implementation using object storage
 * Rationale: Implements core interface with file-based persistence
 */

import { injectable, inject } from 'tsyringe';
import { Result, ok, err, propagateError } from '../../shared/result';
import { NotFoundError, StorageError } from '../../shared/errors';
import { IArgumentRepository } from '../../core/repositories/IArgumentRepository';
import { Argument, ArgumentContent } from '../../core/entities/Argument';
import { Rebuttal, VALID_REBUTTAL_TYPES } from '../../core/entities/Rebuttal';
import { Concession, VALID_CONCESSION_TYPES } from '../../core/entities/Concession';
import { ArgumentId, ArgumentIdGenerator } from '../../core/value-objects/ArgumentId';
import { SimulationId, SimulationIdGenerator } from '../../core/value-objects/SimulationId';
import { AgentId } from '../../core/value-objects/AgentId';
import { TimestampGenerator } from '../../core/value-objects/Timestamp';
import { parseArgumentType } from '../../core/value-objects/ArgumentType';
import { ICryptoService } from '../../core/services/ICryptoService';
import { ObjectStorage } from './ObjectStorage';
import { TOKENS } from '../../shared/container';
import { ArgumentDataSchema, type ArgumentData, parseStorageData } from './schemas';

@injectable()
export class FileArgumentRepository implements IArgumentRepository {
  constructor(
    @inject(TOKENS.ObjectStorage) private readonly storage: ObjectStorage,
    @inject(TOKENS.CryptoService) private readonly cryptoService: ICryptoService
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
      citationIds: argument.citationIds as string[],
    };

    const result = await this.storage.store('arguments', data as unknown as Record<string, unknown>);
    if (result.isErr()) {
      return propagateError(result);
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
      citationIds: rebuttal.citationIds as string[],
      targetArgumentId: rebuttal.targetArgumentId,
      rebuttalType: rebuttal.rebuttalType,
    };

    const result = await this.storage.store('arguments', data as unknown as Record<string, unknown>);
    if (result.isErr()) {
      return propagateError(result);
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
      citationIds: concession.citationIds as string[],
      targetArgumentId: concession.targetArgumentId,
      concessionType: concession.concessionType,
      ...(concession.conditions !== undefined && { conditions: concession.conditions }),
      ...(concession.explanation !== undefined && { explanation: concession.explanation }),
    };

    const result = await this.storage.store('arguments', data as unknown as Record<string, unknown>);
    if (result.isErr()) {
      return propagateError(result);
    }

    return ok(concession.id);
  }

  public async findById(id: ArgumentId | string): Promise<Result<Argument, NotFoundError | StorageError>> {
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

    return this.deserializeArgument(result.value.data);
  }

  public async findBySimulation(simulationId: SimulationId): Promise<Result<Argument[], StorageError>> {
    const listResult = await this.storage.list('arguments');
    if (listResult.isErr()) {
      return propagateError(listResult);
    }

    // PERFORMANCE: Fetch all arguments in parallel instead of sequentially
    const retrievePromises = listResult.value.map(id =>
      this.storage.retrieve('arguments', id)
    );
    const results = await Promise.all(retrievePromises);

    const argumentList: Argument[] = [];
    for (const argResult of results) {
      if (argResult.isOk()) {
        const data = argResult.value.data as Record<string, unknown>;
        if (data.simulationId === simulationId) {
          const deserializeResult = this.deserializeArgument(data);
          if (deserializeResult.isErr()) {
            return propagateError(deserializeResult);
          }
          argumentList.push(deserializeResult.value);
        }
      }
    }

    return ok(argumentList);
  }

  public async findByAgent(agentId: AgentId): Promise<Result<Argument[], StorageError>> {
    const listResult = await this.storage.list('arguments');
    if (listResult.isErr()) {
      return propagateError(listResult);
    }

    // PERFORMANCE: Fetch all arguments in parallel instead of sequentially
    const retrievePromises = listResult.value.map(id =>
      this.storage.retrieve('arguments', id)
    );
    const results = await Promise.all(retrievePromises);

    const argumentList: Argument[] = [];
    for (const argResult of results) {
      if (argResult.isOk()) {
        const data = argResult.value.data as Record<string, unknown>;
        if (data.agentId === agentId) {
          const deserializeResult = this.deserializeArgument(data);
          if (deserializeResult.isErr()) {
            return propagateError(deserializeResult);
          }
          argumentList.push(deserializeResult.value);
        }
      }
    }

    return ok(argumentList);
  }

  public async findReferencingArguments(targetId: ArgumentId): Promise<Result<Argument[], StorageError>> {
    const listResult = await this.storage.list('arguments');
    if (listResult.isErr()) {
      return propagateError(listResult);
    }

    // PERFORMANCE: Fetch all arguments in parallel instead of sequentially
    const retrievePromises = listResult.value.map(id =>
      this.storage.retrieve('arguments', id)
    );
    const results = await Promise.all(retrievePromises);

    const argumentList: Argument[] = [];
    for (const argResult of results) {
      if (argResult.isOk()) {
        const data = argResult.value.data as Record<string, unknown>;
        if (data.targetArgumentId === targetId) {
          const deserializeResult = this.deserializeArgument(data);
          if (deserializeResult.isErr()) {
            return propagateError(deserializeResult);
          }
          argumentList.push(deserializeResult.value);
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
      return propagateError(argumentsResult);
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
      return propagateError(referencingResult);
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
   * Creates an Argument from Zod-validated storage data
   * ARCHITECTURE: Domain validation after Zod schema validation
   * Rationale: Zod validates shape, domain validators ensure semantic correctness
   */
  private deserializeBaseArgument(data: ArgumentData): Result<Argument, Error> {
    // Domain validation: Validate ArgumentType matches domain enum
    const typeResult = parseArgumentType(data.type);
    if (typeResult.isErr()) {
      return err(new Error(`Invalid argument type '${data.type}' - ${typeResult.error.message}`));
    }

    // Domain validation: Validate SimulationId format
    const simIdResult = SimulationIdGenerator.fromHash(data.simulationId);
    if (simIdResult.isErr()) {
      return err(new Error(`Invalid simulationId '${data.simulationId}' - ${simIdResult.error.message}`));
    }

    // Domain validation: Validate Timestamp format
    const timestampResult = TimestampGenerator.fromString(data.timestamp);
    if (timestampResult.isErr()) {
      return err(new Error(`Invalid timestamp '${data.timestamp}' - ${timestampResult.error.message}`));
    }

    // SAFETY: Cast is safe because Zod validated the structure at runtime
    // exactOptionalPropertyTypes causes inference mismatch but runtime shape is correct
    return Argument.create({
      agentId: data.agentId as AgentId,
      type: typeResult.value,
      content: data.content as unknown as ArgumentContent,
      simulationId: simIdResult.value,
      timestamp: timestampResult.value,
      sequenceNumber: data.metadata.sequenceNumber,
      citationIds: data.citationIds || [],
    }, this.cryptoService);
  }

  /**
   * Creates a Rebuttal from Zod-validated storage data
   * ARCHITECTURE: Domain validation after Zod schema validation
   * Rationale: Zod validates shape, domain validators ensure semantic correctness
   */
  private deserializeRebuttal(data: ArgumentData): Result<Rebuttal, Error> {
    // Domain validation: Validate ArgumentType matches domain enum
    const typeResult = parseArgumentType(data.type);
    if (typeResult.isErr()) {
      return err(new Error(`Invalid argument type '${data.type}' - ${typeResult.error.message}`));
    }

    // Domain validation: Validate SimulationId format
    const simIdResult = SimulationIdGenerator.fromHash(data.simulationId);
    if (simIdResult.isErr()) {
      return err(new Error(`Invalid simulationId '${data.simulationId}' - ${simIdResult.error.message}`));
    }

    // Domain validation: Validate Timestamp format
    const timestampResult = TimestampGenerator.fromString(data.timestamp);
    if (timestampResult.isErr()) {
      return err(new Error(`Invalid timestamp '${data.timestamp}' - ${timestampResult.error.message}`));
    }

    // Domain validation: Validate targetArgumentId (required for rebuttals)
    if (!data.targetArgumentId) {
      return err(new Error('Rebuttal missing targetArgumentId'));
    }
    const targetIdResult = ArgumentIdGenerator.fromHash(data.targetArgumentId);
    if (targetIdResult.isErr()) {
      return err(new Error(`Invalid targetArgumentId '${data.targetArgumentId}' - ${targetIdResult.error.message}`));
    }

    // Domain validation: Validate rebuttalType (required for rebuttals)
    if (!data.rebuttalType || !VALID_REBUTTAL_TYPES.includes(data.rebuttalType as typeof VALID_REBUTTAL_TYPES[number])) {
      return err(new Error(`Invalid rebuttalType '${data.rebuttalType}'. Must be one of: ${VALID_REBUTTAL_TYPES.join(', ')}`));
    }

    // SAFETY: Cast is safe because Zod validated the structure at runtime
    return Rebuttal.create({
      agentId: data.agentId as AgentId,
      type: typeResult.value,
      content: data.content as unknown as ArgumentContent,
      simulationId: simIdResult.value,
      timestamp: timestampResult.value,
      targetArgumentId: targetIdResult.value,
      rebuttalType: data.rebuttalType as typeof VALID_REBUTTAL_TYPES[number],
      citationIds: data.citationIds || [],
    }, this.cryptoService);
  }

  /**
   * Creates a Concession from Zod-validated storage data
   * ARCHITECTURE: Domain validation after Zod schema validation
   * Rationale: Zod validates shape, domain validators ensure semantic correctness
   */
  private deserializeConcession(data: ArgumentData): Result<Concession, Error> {
    // Domain validation: Validate ArgumentType matches domain enum
    const typeResult = parseArgumentType(data.type);
    if (typeResult.isErr()) {
      return err(new Error(`Invalid argument type '${data.type}' - ${typeResult.error.message}`));
    }

    // Domain validation: Validate SimulationId format
    const simIdResult = SimulationIdGenerator.fromHash(data.simulationId);
    if (simIdResult.isErr()) {
      return err(new Error(`Invalid simulationId '${data.simulationId}' - ${simIdResult.error.message}`));
    }

    // Domain validation: Validate Timestamp format
    const timestampResult = TimestampGenerator.fromString(data.timestamp);
    if (timestampResult.isErr()) {
      return err(new Error(`Invalid timestamp '${data.timestamp}' - ${timestampResult.error.message}`));
    }

    // Domain validation: Validate targetArgumentId (required for concessions)
    if (!data.targetArgumentId) {
      return err(new Error('Concession missing targetArgumentId'));
    }
    const targetIdResult = ArgumentIdGenerator.fromHash(data.targetArgumentId);
    if (targetIdResult.isErr()) {
      return err(new Error(`Invalid targetArgumentId '${data.targetArgumentId}' - ${targetIdResult.error.message}`));
    }

    // Domain validation: Validate concessionType (required for concessions)
    if (!data.concessionType || !VALID_CONCESSION_TYPES.includes(data.concessionType as typeof VALID_CONCESSION_TYPES[number])) {
      return err(new Error(`Invalid concessionType '${data.concessionType}'. Must be one of: ${VALID_CONCESSION_TYPES.join(', ')}`));
    }

    // SAFETY: Cast is safe because Zod validated the structure at runtime
    const params = {
      agentId: data.agentId as AgentId,
      type: typeResult.value,
      content: data.content as unknown as ArgumentContent,
      simulationId: simIdResult.value,
      timestamp: timestampResult.value,
      targetArgumentId: targetIdResult.value,
      concessionType: data.concessionType as 'full' | 'partial' | 'conditional',
      citationIds: data.citationIds || [],
      ...(data.conditions !== undefined && { conditions: data.conditions }),
      ...(data.explanation !== undefined && { explanation: data.explanation }),
    };
    return Concession.create(params, this.cryptoService);
  }

  /**
   * Deserializes argument data from storage
   * ARCHITECTURE: Uses Zod for schema validation at storage boundary
   * Pattern: Parse, don't validate - validates shape before domain logic
   * Returns Result to allow callers to handle corruption gracefully
   */
  private deserializeArgument(rawData: unknown): Result<Argument, StorageError> {
    // STEP 1: Schema validation with Zod (parse, don't validate)
    const parseResult = parseStorageData(ArgumentDataSchema, rawData, 'argument');
    if (parseResult.isErr()) {
      return propagateError(parseResult);
    }
    const data = parseResult.value;

    // STEP 2: Strategy pattern for domain deserialization
    const deserializers = {
      argument: (d: ArgumentData) => this.deserializeBaseArgument(d),
      rebuttal: (d: ArgumentData) => this.deserializeRebuttal(d),
      concession: (d: ArgumentData) => this.deserializeConcession(d),
    };

    const type = this.detectArgumentType(data);
    const result = deserializers[type](data);

    // Map domain validation errors to StorageError
    if (result.isErr()) {
      return err(new StorageError(
        `Failed to deserialize ${type}: ${result.error.message}`,
        'deserialize'
      ));
    }

    return ok(result.value);
  }
}