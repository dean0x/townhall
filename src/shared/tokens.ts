/**
 * ARCHITECTURE: Type-safe dependency injection tokens
 * Pattern: Generic tokens that preserve type information at compile time
 * Rationale: Symbol tokens lose type info; these preserve it for DI resolution
 *
 * This file defines FRAMEWORK-LEVEL tokens only. Simulation-specific tokens
 * are defined in their respective modules (e.g., simulations/debate/tokens.ts).
 *
 * The interface layer (container-config.ts) is responsible for importing and
 * registering simulation-specific tokens - this keeps shared/ free of
 * simulation dependencies.
 *
 * Usage in registration:
 *   container.register(Tokens.Logger.symbol, { useClass: StructuredLogger });
 *
 * Usage in injection:
 *   @inject(Tokens.Logger.symbol) private logger: ILogger
 *
 * Usage in resolution:
 *   resolve(Tokens.Logger) // returns ILogger
 */

import { createToken } from './injection';

// Core interfaces (framework-level, no simulation dependencies)
import type { IAgentRepository } from '../core/repositories/IAgentRepository';
import type { ICitationRepository } from '../core/repositories/ICitationRepository';
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
 * Framework-level typed injection tokens.
 * Does not include simulation-specific tokens (see DebateTokens).
 */
const FrameworkTokens = {
  // Core Repositories (shared across simulations)
  AgentRepository: createToken<IAgentRepository>('AgentRepository'),
  CitationRepository: createToken<ICitationRepository>('CitationRepository'),

  // Core Services
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
 * Framework-level typed injection tokens.
 * Simulation-specific tokens should be imported directly from their modules.
 */
export const Tokens = FrameworkTokens;
