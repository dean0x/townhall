/**
 * ARCHITECTURE: Type-safe dependency injection tokens
 * Pattern: Generic tokens that preserve type information at compile time
 * Rationale: Symbol tokens lose type info; these preserve it for DI resolution
 *
 * Usage in registration:
 *   container.register(Tokens.ArgumentRepository.symbol, { useClass: FileArgumentRepository });
 *
 * Usage in injection:
 *   @inject(Tokens.ArgumentRepository.symbol) private repo: IArgumentRepository
 *
 * Usage in resolution:
 *   resolve(Tokens.ArgumentRepository) // returns IArgumentRepository
 */

import { createToken } from './injection';

// Repository interfaces
import type { IArgumentRepository } from '../core/repositories/IArgumentRepository';
import type { ISimulationRepository } from '../core/repositories/ISimulationRepository';
import type { IAgentRepository } from '../core/repositories/IAgentRepository';
import type { ICitationRepository } from '../core/repositories/ICitationRepository';

// Core services
import type { ArgumentValidator } from '../core/services/ArgumentValidator';
import type { RelationshipBuilder } from '../core/services/RelationshipBuilder';
import type { VoteCalculator } from '../core/services/VoteCalculator';
import type { ICryptoService } from '../core/services/ICryptoService';
import type { ITimestampService } from '../core/services/ITimestampService';

// Infrastructure
import type { ObjectStorage } from '../infrastructure/storage/ObjectStorage';
import type { IEventBus } from '../application/ports/IEventBus';
import type { ILogger } from '../application/ports/ILogger';
import type { HashResolver } from '../infrastructure/storage/HashResolver';
import type { IStorageInitializer } from '../application/ports/IStorageInitializer';

// Application layer - buses
import type { ICommandBus } from '../application/handlers/CommandBus';
import type { IQueryBus } from '../application/handlers/QueryBus';

// Command handlers
import type { InitializeRepositoryHandler } from '../application/handlers/InitializeRepositoryHandler';
import type { InitializeDebateHandler } from '../application/handlers/InitializeDebateHandler';
import type { CreateArgumentHandler } from '../application/handlers/CreateArgumentHandler';
import type { SubmitRebuttalHandler } from '../application/handlers/SubmitRebuttalHandler';
import type { SubmitConcessionHandler } from '../application/handlers/SubmitConcessionHandler';
import type { VoteToCloseHandler } from '../application/handlers/VoteToCloseHandler';
import type { CheckoutSimulationHandler } from '../application/handlers/CheckoutSimulationHandler';
import type { CreateCitationHandler } from '../application/handlers/CreateCitationHandler';

// Query handlers
import type { GetDebateHistoryHandler } from '../application/handlers/GetDebateHistoryHandler';
import type { GetArgumentHandler } from '../application/handlers/GetArgumentHandler';
import type { GetArgumentChainHandler } from '../application/handlers/GetArgumentChainHandler';
import type { GetCitationHandler } from '../application/handlers/GetCitationHandler';
import type { GetCitationStatsHandler } from '../application/handlers/GetCitationStatsHandler';

/**
 * All typed injection tokens for the application.
 * Use these instead of the legacy Symbol-based TOKENS.
 */
export const Tokens = {
  // Repositories
  ArgumentRepository: createToken<IArgumentRepository>('ArgumentRepository'),
  SimulationRepository: createToken<ISimulationRepository>('SimulationRepository'),
  AgentRepository: createToken<IAgentRepository>('AgentRepository'),
  CitationRepository: createToken<ICitationRepository>('CitationRepository'),

  // Core Services
  ArgumentValidator: createToken<ArgumentValidator>('ArgumentValidator'),
  RelationshipBuilder: createToken<RelationshipBuilder>('RelationshipBuilder'),
  VoteCalculator: createToken<VoteCalculator>('VoteCalculator'),
  CryptoService: createToken<ICryptoService>('CryptoService'),
  TimestampService: createToken<ITimestampService>('TimestampService'),

  // Infrastructure
  ObjectStorage: createToken<ObjectStorage>('ObjectStorage'),
  EventBus: createToken<IEventBus>('EventBus'),
  Logger: createToken<ILogger>('Logger'),
  HashResolver: createToken<HashResolver>('HashResolver'),
  StorageInitializer: createToken<IStorageInitializer>('StorageInitializer'),

  // Application Layer - Buses
  CommandBus: createToken<ICommandBus>('CommandBus'),
  QueryBus: createToken<IQueryBus>('QueryBus'),

  // Command Handlers
  InitializeRepositoryHandler: createToken<InitializeRepositoryHandler>('InitializeRepositoryHandler'),
  InitializeDebateHandler: createToken<InitializeDebateHandler>('InitializeDebateHandler'),
  CreateArgumentHandler: createToken<CreateArgumentHandler>('CreateArgumentHandler'),
  SubmitRebuttalHandler: createToken<SubmitRebuttalHandler>('SubmitRebuttalHandler'),
  SubmitConcessionHandler: createToken<SubmitConcessionHandler>('SubmitConcessionHandler'),
  VoteToCloseHandler: createToken<VoteToCloseHandler>('VoteToCloseHandler'),
  CheckoutSimulationHandler: createToken<CheckoutSimulationHandler>('CheckoutSimulationHandler'),
  CreateCitationHandler: createToken<CreateCitationHandler>('CreateCitationHandler'),

  // Query Handlers
  GetDebateHistoryHandler: createToken<GetDebateHistoryHandler>('GetDebateHistoryHandler'),
  GetArgumentHandler: createToken<GetArgumentHandler>('GetArgumentHandler'),
  GetArgumentChainHandler: createToken<GetArgumentChainHandler>('GetArgumentChainHandler'),
  GetCitationHandler: createToken<GetCitationHandler>('GetCitationHandler'),
  GetCitationStatsHandler: createToken<GetCitationStatsHandler>('GetCitationStatsHandler'),
} as const;

/**
 * Legacy TOKENS constant for backward compatibility during migration.
 * Maps to the symbols from the typed tokens.
 *
 * @deprecated Use Tokens directly with resolve() instead
 */
export const TOKENS = {
  ArgumentRepository: Tokens.ArgumentRepository.symbol,
  SimulationRepository: Tokens.SimulationRepository.symbol,
  AgentRepository: Tokens.AgentRepository.symbol,
  CitationRepository: Tokens.CitationRepository.symbol,
  ArgumentValidator: Tokens.ArgumentValidator.symbol,
  RelationshipBuilder: Tokens.RelationshipBuilder.symbol,
  VoteCalculator: Tokens.VoteCalculator.symbol,
  CryptoService: Tokens.CryptoService.symbol,
  TimestampService: Tokens.TimestampService.symbol,
  ObjectStorage: Tokens.ObjectStorage.symbol,
  EventBus: Tokens.EventBus.symbol,
  Logger: Tokens.Logger.symbol,
  HashResolver: Tokens.HashResolver.symbol,
  StorageInitializer: Tokens.StorageInitializer.symbol,
  CommandBus: Tokens.CommandBus.symbol,
  QueryBus: Tokens.QueryBus.symbol,
  InitializeRepositoryHandler: Tokens.InitializeRepositoryHandler.symbol,
  InitializeDebateHandler: Tokens.InitializeDebateHandler.symbol,
  CreateArgumentHandler: Tokens.CreateArgumentHandler.symbol,
  SubmitRebuttalHandler: Tokens.SubmitRebuttalHandler.symbol,
  SubmitConcessionHandler: Tokens.SubmitConcessionHandler.symbol,
  VoteToCloseHandler: Tokens.VoteToCloseHandler.symbol,
  CheckoutSimulationHandler: Tokens.CheckoutSimulationHandler.symbol,
  CreateCitationHandler: Tokens.CreateCitationHandler.symbol,
  GetDebateHistoryHandler: Tokens.GetDebateHistoryHandler.symbol,
  GetArgumentHandler: Tokens.GetArgumentHandler.symbol,
  GetArgumentChainHandler: Tokens.GetArgumentChainHandler.symbol,
  GetCitationHandler: Tokens.GetCitationHandler.symbol,
  GetCitationStatsHandler: Tokens.GetCitationStatsHandler.symbol,
  IndexManager: Symbol.for('IndexManager'), // Legacy token not yet typed
} as const;

export type TokenType = typeof TOKENS[keyof typeof TOKENS];
