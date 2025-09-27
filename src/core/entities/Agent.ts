/**
 * ARCHITECTURE: Core domain entity representing debate participants
 * Pattern: Immutable entity with factory method and validation
 * Rationale: Agents are defined via MD files but cached as domain entities
 */

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

  public static create(params: CreateAgentParams): Agent {
    this.validateName(params.name);
    this.validateType(params.type);
    this.validateCapabilities(params.capabilities);
    this.validateFilePath(params.filePath);

    return new Agent(
      params.id,
      params.name,
      params.type,
      params.capabilities,
      params.description,
      params.filePath
    );
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

  private static validateName(name: string): void {
    if (name.length === 0 || name.length > 100) {
      throw new Error('Agent name must be between 1 and 100 characters');
    }
  }

  private static validateType(type: AgentType): void {
    if (!VALID_AGENT_TYPES.includes(type)) {
      throw new Error(`Invalid agent type: ${type}. Must be one of: ${VALID_AGENT_TYPES.join(', ')}`);
    }
  }

  private static validateCapabilities(capabilities: readonly string[]): void {
    if (capabilities.length === 0) {
      throw new Error('Agent must have at least one capability');
    }

    const invalidCapabilities = capabilities.filter(
      cap => !VALID_CAPABILITIES.includes(cap as AgentCapability)
    );

    if (invalidCapabilities.length > 0) {
      throw new Error(
        `Invalid capabilities: ${invalidCapabilities.join(', ')}. Valid capabilities: ${VALID_CAPABILITIES.join(', ')}`
      );
    }
  }

  private static validateFilePath(filePath: string): void {
    if (!filePath.endsWith('.md')) {
      throw new Error('Agent file path must end with .md');
    }
    if (!filePath.includes('agents/')) {
      throw new Error('Agent file path must be within agents/ directory');
    }
  }
}