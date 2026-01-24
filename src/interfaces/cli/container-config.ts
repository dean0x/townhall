/**
 * ARCHITECTURE: Dependency injection configuration for CLI
 * Pattern: Composition root pattern
 * Rationale: Wire up all dependencies at application startup
 *
 * This is the composition root where framework tokens and simulation-specific
 * tokens are merged. The interface layer is the appropriate place for this
 * cross-boundary import.
 */

import { container } from 'tsyringe';
import { Tokens as FrameworkTokens } from '../../shared/tokens';
import { DebateTokens } from '../../simulations/debate/tokens';
import { resolve } from '../../shared/injection';

// Debate services
import { ArgumentValidator, RelationshipBuilder, VoteCalculator } from '../../simulations/debate';

/**
 * Merged tokens for CLI use - combines framework and debate tokens.
 * This is the single place where cross-boundary token merging happens.
 */
export const Tokens = {
  ...FrameworkTokens,
  ...DebateTokens,
} as const;

// Application layer
import { CommandBus } from '../../application/handlers/CommandBus';
import { QueryBus } from '../../application/handlers/QueryBus';
import { InitializeRepositoryHandler } from '../../application/handlers/InitializeRepositoryHandler';
import { InitializeDebateHandler } from '../../application/handlers/InitializeDebateHandler';
import { CreateArgumentHandler } from '../../application/handlers/CreateArgumentHandler';
import { GetDebateHistoryHandler } from '../../application/handlers/GetDebateHistoryHandler';
import { SubmitRebuttalHandler } from '../../application/handlers/SubmitRebuttalHandler';
import { SubmitConcessionHandler } from '../../application/handlers/SubmitConcessionHandler';
import { VoteToCloseHandler } from '../../application/handlers/VoteToCloseHandler';
import { CheckoutSimulationHandler } from '../../application/handlers/CheckoutSimulationHandler';
import { GetArgumentHandler } from '../../application/handlers/GetArgumentHandler';
import { GetArgumentChainHandler } from '../../application/handlers/GetArgumentChainHandler';
import { CreateCitationHandler } from '../../application/handlers/CreateCitationHandler';
import { GetCitationHandler } from '../../application/handlers/GetCitationHandler';
import { GetCitationStatsHandler } from '../../application/handlers/GetCitationStatsHandler';

// Infrastructure
import { ObjectStorage } from '../../infrastructure/storage/ObjectStorage';
import { FileArgumentRepository } from '../../infrastructure/storage/FileArgumentRepository';
import { FileSimulationRepository } from '../../infrastructure/storage/FileSimulationRepository';
import { FileAgentRepository } from '../../infrastructure/storage/FileAgentRepository';
import { FileCitationRepository } from '../../infrastructure/storage/FileCitationRepository';
import { InMemoryEventBus } from '../../infrastructure/events/InMemoryEventBus';
import { StructuredLogger } from '../../infrastructure/logging/StructuredLogger';
import { HashResolver } from '../../infrastructure/storage/HashResolver';
import { NodeCryptoService } from '../../infrastructure/crypto/NodeCryptoService';
import { SystemTimestampService } from '../../infrastructure/time/SystemTimestampService';

export function configureContainer(): typeof container {
  // Core services (no dependencies)
  container.register(Tokens.ArgumentValidator.symbol, { useClass: ArgumentValidator });
  container.register(Tokens.RelationshipBuilder.symbol, { useClass: RelationshipBuilder });
  container.register(Tokens.VoteCalculator.symbol, { useClass: VoteCalculator });

  // Infrastructure - Application ports
  container.register(Tokens.CryptoService.symbol, { useClass: NodeCryptoService });
  container.register(Tokens.TimestampService.symbol, { useClass: SystemTimestampService });

  // Infrastructure - Storage and repositories
  const objectStorage = new ObjectStorage('.townhall');
  container.register(Tokens.ObjectStorage.symbol, {
    useValue: objectStorage
  });
  // Register ObjectStorage as IStorageInitializer for application layer
  container.register(Tokens.StorageInitializer.symbol, {
    useValue: objectStorage
  });
  container.register(Tokens.HashResolver.symbol, { useClass: HashResolver });
  container.register(Tokens.ArgumentRepository.symbol, { useClass: FileArgumentRepository });
  container.register(Tokens.SimulationRepository.symbol, { useClass: FileSimulationRepository });
  container.register(Tokens.AgentRepository.symbol, { useClass: FileAgentRepository });
  container.register(Tokens.CitationRepository.symbol, { useClass: FileCitationRepository });
  container.register(Tokens.EventBus.symbol, { useClass: InMemoryEventBus });
  container.register(Tokens.Logger.symbol, {
    useFactory: () => new StructuredLogger({ component: 'townhall-cli' })
  });

  // Application layer - handlers
  container.register(Tokens.InitializeRepositoryHandler.symbol, { useClass: InitializeRepositoryHandler });
  container.register(Tokens.InitializeDebateHandler.symbol, { useClass: InitializeDebateHandler });
  container.register(Tokens.CreateArgumentHandler.symbol, { useClass: CreateArgumentHandler });
  container.register(Tokens.GetDebateHistoryHandler.symbol, { useClass: GetDebateHistoryHandler });
  container.register(Tokens.SubmitRebuttalHandler.symbol, { useClass: SubmitRebuttalHandler });
  container.register(Tokens.SubmitConcessionHandler.symbol, { useClass: SubmitConcessionHandler });
  container.register(Tokens.VoteToCloseHandler.symbol, { useClass: VoteToCloseHandler });
  container.register(Tokens.CheckoutSimulationHandler.symbol, { useClass: CheckoutSimulationHandler });
  container.register(Tokens.GetArgumentHandler.symbol, { useClass: GetArgumentHandler });
  container.register(Tokens.GetArgumentChainHandler.symbol, { useClass: GetArgumentChainHandler });
  container.register(Tokens.CreateCitationHandler.symbol, { useClass: CreateCitationHandler });
  container.register(Tokens.GetCitationHandler.symbol, { useClass: GetCitationHandler });
  container.register(Tokens.GetCitationStatsHandler.symbol, { useClass: GetCitationStatsHandler });

  // Application layer - buses with handler registration
  container.register(Tokens.CommandBus.symbol, {
    useFactory: () => {
      const commandBus = new CommandBus();
      // Register command handlers (using typed resolve for type safety)
      commandBus.register('InitializeRepositoryCommand', resolve(Tokens.InitializeRepositoryHandler));
      commandBus.register('InitializeDebateCommand', resolve(Tokens.InitializeDebateHandler));
      commandBus.register('CreateArgumentCommand', resolve(Tokens.CreateArgumentHandler));
      commandBus.register('SubmitRebuttalCommand', resolve(Tokens.SubmitRebuttalHandler));
      commandBus.register('SubmitConcessionCommand', resolve(Tokens.SubmitConcessionHandler));
      commandBus.register('VoteToCloseCommand', resolve(Tokens.VoteToCloseHandler));
      commandBus.register('CheckoutSimulationCommand', resolve(Tokens.CheckoutSimulationHandler));
      commandBus.register('CreateCitationCommand', resolve(Tokens.CreateCitationHandler));
      return commandBus;
    }
  });

  container.register(Tokens.QueryBus.symbol, {
    useFactory: () => {
      const queryBus = new QueryBus();
      // Register query handlers (using typed resolve for type safety)
      queryBus.register('GetDebateHistoryQuery', resolve(Tokens.GetDebateHistoryHandler));
      queryBus.register('GetArgumentQuery', resolve(Tokens.GetArgumentHandler));
      queryBus.register('GetArgumentChainQuery', resolve(Tokens.GetArgumentChainHandler));
      queryBus.register('GetCitationQuery', resolve(Tokens.GetCitationHandler));
      queryBus.register('GetCitationStatsQuery', resolve(Tokens.GetCitationStatsHandler));
      return queryBus;
    }
  });

  return container;
}