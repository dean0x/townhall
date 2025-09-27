/**
 * Dependency Injection container configuration
 * Uses TSyringe for managing application dependencies
 */

import 'reflect-metadata';
import { container } from 'tsyringe';

// Tokens for dependency injection
export const TOKENS = {
  // Repositories
  ArgumentRepository: Symbol.for('ArgumentRepository'),
  SimulationRepository: Symbol.for('SimulationRepository'),
  AgentRepository: Symbol.for('AgentRepository'),

  // Services
  ArgumentValidator: Symbol.for('ArgumentValidator'),
  RelationshipBuilder: Symbol.for('RelationshipBuilder'),
  VoteCalculator: Symbol.for('VoteCalculator'),

  // Infrastructure
  ObjectStorage: Symbol.for('ObjectStorage'),
  IndexManager: Symbol.for('IndexManager'),
  EventBus: Symbol.for('EventBus'),
  Logger: Symbol.for('Logger'),
  HashResolver: Symbol.for('HashResolver'),

  // Application ports
  CommandBus: Symbol.for('CommandBus'),
  QueryBus: Symbol.for('QueryBus'),

  // Command Handlers
  InitializeDebateHandler: Symbol.for('InitializeDebateHandler'),
  CreateArgumentHandler: Symbol.for('CreateArgumentHandler'),
  SubmitRebuttalHandler: Symbol.for('SubmitRebuttalHandler'),
  SubmitConcessionHandler: Symbol.for('SubmitConcessionHandler'),
  VoteToCloseHandler: Symbol.for('VoteToCloseHandler'),

  // Query Handlers
  GetDebateHistoryHandler: Symbol.for('GetDebateHistoryHandler'),
  GetArgumentHandler: Symbol.for('GetArgumentHandler'),
  GetArgumentChainHandler: Symbol.for('GetArgumentChainHandler'),
} as const;

export type TokenType = typeof TOKENS[keyof typeof TOKENS];

// Container instance for global access
export { container };

// Helper function to configure the container
export const configureContainer = (): void => {
  // Configuration will be done during infrastructure setup
  // This is just the foundation
};