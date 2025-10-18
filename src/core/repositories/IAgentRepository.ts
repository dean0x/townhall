/**
 * ARCHITECTURE: Repository interface for agent management
 * Pattern: Handles MD file-based agent definitions
 * Rationale: Agents defined as markdown files with YAML frontmatter
 */

import { Result } from '../../shared/result';
import { NotFoundError, StorageError, ValidationError } from '../../shared/errors';
import { Agent } from '../entities/Agent';
import { AgentId } from '../value-objects/AgentId';

export interface AgentMetadata {
  readonly id: AgentId;
  readonly name: string;
  readonly filePath: string;
  readonly lastModified: Date;
}

export interface IAgentRepository {
  /**
   * Find agent by ID
   */
  findById(id: AgentId): Promise<Result<Agent, NotFoundError>>;

  /**
   * Load agent from MD file
   */
  loadFromFile(filePath: string): Promise<Result<Agent, ValidationError | StorageError>>;

  /**
   * Save agent to MD file
   */
  saveToFile(agent: Agent): Promise<Result<void, StorageError>>;

  /**
   * List all available agents
   */
  listAll(): Promise<Result<Agent[], StorageError>>;

  /**
   * Get agent metadata without loading full content
   */
  getMetadata(): Promise<Result<AgentMetadata[], StorageError>>;

  /**
   * Check if agent exists
   */
  exists(id: AgentId): Promise<Result<boolean, StorageError>>;

  /**
   * Validate agent MD file format
   */
  validateFile(filePath: string): Promise<Result<void, ValidationError>>;

  /**
   * Watch for changes to agent files (optional)
   */
  watchForChanges?(callback: (agent: Agent) => void): void;

  /**
   * Refresh agent cache from file system
   */
  refresh(): Promise<Result<void, StorageError>>;
}