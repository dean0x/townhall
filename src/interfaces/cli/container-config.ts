/**
 * ARCHITECTURE: Dependency injection configuration for CLI
 * Pattern: Composition root pattern
 * Rationale: Wire up all dependencies at application startup
 */

import { container } from 'tsyringe';
import { TOKENS, Tokens } from '../../shared/tokens';
import { resolve } from '../../shared/injection';

// Core services
import { ArgumentValidator } from '../../simulations/debate';
import { RelationshipBuilder } from '../../core/services/RelationshipBuilder';
import { VoteCalculator } from '../../core/services/VoteCalculator';

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
  container.register(TOKENS.ArgumentValidator, { useClass: ArgumentValidator });
  container.register(TOKENS.RelationshipBuilder, { useClass: RelationshipBuilder });
  container.register(TOKENS.VoteCalculator, { useClass: VoteCalculator });

  // Infrastructure - Application ports
  container.register(TOKENS.CryptoService, { useClass: NodeCryptoService });
  container.register(TOKENS.TimestampService, { useClass: SystemTimestampService });

  // Infrastructure - Storage and repositories
  const objectStorage = new ObjectStorage('.townhall');
  container.register(TOKENS.ObjectStorage, {
    useValue: objectStorage
  });
  // Register ObjectStorage as IStorageInitializer for application layer
  container.register(TOKENS.StorageInitializer, {
    useValue: objectStorage
  });
  container.register(TOKENS.HashResolver, { useClass: HashResolver });
  container.register(TOKENS.ArgumentRepository, { useClass: FileArgumentRepository });
  container.register(TOKENS.SimulationRepository, { useClass: FileSimulationRepository });
  container.register(TOKENS.AgentRepository, { useClass: FileAgentRepository });
  container.register(TOKENS.CitationRepository, { useClass: FileCitationRepository });
  container.register(TOKENS.EventBus, { useClass: InMemoryEventBus });
  container.register(TOKENS.Logger, {
    useFactory: () => new StructuredLogger({ component: 'townhall-cli' })
  });

  // Application layer - handlers
  container.register(TOKENS.InitializeRepositoryHandler, { useClass: InitializeRepositoryHandler });
  container.register(TOKENS.InitializeDebateHandler, { useClass: InitializeDebateHandler });
  container.register(TOKENS.CreateArgumentHandler, { useClass: CreateArgumentHandler });
  container.register(TOKENS.GetDebateHistoryHandler, { useClass: GetDebateHistoryHandler });
  container.register(TOKENS.SubmitRebuttalHandler, { useClass: SubmitRebuttalHandler });
  container.register(TOKENS.SubmitConcessionHandler, { useClass: SubmitConcessionHandler });
  container.register(TOKENS.VoteToCloseHandler, { useClass: VoteToCloseHandler });
  container.register(TOKENS.CheckoutSimulationHandler, { useClass: CheckoutSimulationHandler });
  container.register(TOKENS.GetArgumentHandler, { useClass: GetArgumentHandler });
  container.register(TOKENS.GetArgumentChainHandler, { useClass: GetArgumentChainHandler });
  container.register(TOKENS.CreateCitationHandler, { useClass: CreateCitationHandler });
  container.register(TOKENS.GetCitationHandler, { useClass: GetCitationHandler });
  container.register(TOKENS.GetCitationStatsHandler, { useClass: GetCitationStatsHandler });

  // Application layer - buses with handler registration
  container.register(TOKENS.CommandBus, {
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

  container.register(TOKENS.QueryBus, {
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