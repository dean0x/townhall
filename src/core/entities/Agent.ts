/**
 * ARCHITECTURE: Core domain entity representing debate participants
 * Pattern: Immutable entity with factory method and validation
 * Rationale: Agents are defined via MD files but cached as domain entities
 */

import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors';
import { AgentId } from '../value-objects/AgentId';

export type AgentType = 'human' | 'llm' | 'hybrid';

export const VALID_AGENT_TYPES: readonly AgentType[] = ['human', 'llm', 'hybrid'] as const;

export const VALID_CAPABILITIES = [
  'debate',
  'analysis',
  'reasoning',
  'research',
  'synthesis',
  'critique',
] as const;

export type AgentCapability = typeof VALID_CAPABILITIES[number];

export interface CreateAgentParams {
  readonly id: AgentId;
  readonly name: string;
  readonly type: AgentType;
  readonly capabilities: readonly string[];
  readonly description: string;
  readonly filePath: string;
}

export class Agent {
  private constructor(
    public readonly id: AgentId,
    public readonly name: string,
    public readonly type: AgentType,
    public readonly capabilities: readonly string[],
    public readonly description: string,
    public readonly filePath: string
  ) {
    Object.freeze(this);
  }

  public static create(params: CreateAgentParams): Result<Agent, ValidationError> {
    const nameValidation = this.validateName(params.name);
    if (nameValidation.isErr()) {
      return err(nameValidation.error);
    }

    const typeValidation = this.validateType(params.type);
    if (typeValidation.isErr()) {
      return err(typeValidation.error);
    }

    const capabilitiesValidation = this.validateCapabilities(params.capabilities);
    if (capabilitiesValidation.isErr()) {
      return err(capabilitiesValidation.error);
    }

    const filePathValidation = this.validateFilePath(params.filePath);
    if (filePathValidation.isErr()) {
      return err(filePathValidation.error);
    }

    const agent = new Agent(
      params.id,
      params.name,
      params.type,
      params.capabilities,
      params.description,
      params.filePath
    );

    return ok(agent);
  }

  public hasCapability(capability: string): boolean {
    return this.capabilities.includes(capability);
  }

  public withUpdatedDescription(description: string): Agent {
    return new Agent(
      this.id,
      this.name,
      this.type,
      this.capabilities,
      description,
      this.filePath
    );
  }

  private static validateName(name: string): Result<void, ValidationError> {
    if (name.length === 0 || name.length > 100) {
      return err(new ValidationError('Agent name must be between 1 and 100 characters'));
    }
    return ok(undefined);
  }

  private static validateType(type: AgentType): Result<void, ValidationError> {
    if (!VALID_AGENT_TYPES.includes(type)) {
      return err(new ValidationError(`Invalid agent type: ${type}. Must be one of: ${VALID_AGENT_TYPES.join(', ')}`));
    }
    return ok(undefined);
  }

  private static validateCapabilities(capabilities: readonly string[]): Result<void, ValidationError> {
    if (capabilities.length === 0) {
      return err(new ValidationError('Agent must have at least one capability'));
    }

    const invalidCapabilities = capabilities.filter(
      cap => !VALID_CAPABILITIES.includes(cap as AgentCapability)
    );

    if (invalidCapabilities.length > 0) {
      return err(new ValidationError(
        `Invalid capabilities: ${invalidCapabilities.join(', ')}. Valid capabilities: ${VALID_CAPABILITIES.join(', ')}`
      ));
    }
    return ok(undefined);
  }

  private static validateFilePath(filePath: string): Result<void, ValidationError> {
    if (!filePath.endsWith('.md')) {
      return err(new ValidationError('Agent file path must end with .md'));
    }
    if (!filePath.includes('agents/')) {
      return err(new ValidationError('Agent file path must be within agents/ directory'));
    }
    return ok(undefined);
  }
}