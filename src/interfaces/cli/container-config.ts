/**
 * ARCHITECTURE: Dependency injection configuration for CLI
 * Pattern: Composition root pattern
 * Rationale: Wire up all dependencies at application startup
 */

import { container } from 'tsyringe';
import { TOKENS } from '../../shared/container';

// Core services
import { ArgumentValidator } from '../../core/services/ArgumentValidator';
import { RelationshipBuilder } from '../../core/services/RelationshipBuilder';
import { VoteCalculator } from '../../core/services/VoteCalculator';

// Application layer
import { CommandBus } from '../../application/handlers/CommandBus';
import { QueryBus } from '../../application/handlers/QueryBus';
import { InitializeDebateHandler } from '../../application/handlers/InitializeDebateHandler';
import { CreateArgumentHandler } from '../../application/handlers/CreateArgumentHandler';
import { GetDebateHistoryHandler } from '../../application/handlers/GetDebateHistoryHandler';
import { SubmitRebuttalHandler } from '../../application/handlers/SubmitRebuttalHandler';
import { SubmitConcessionHandler } from '../../application/handlers/SubmitConcessionHandler';
import { VoteToCloseHandler } from '../../application/handlers/VoteToCloseHandler';
import { GetArgumentHandler } from '../../application/handlers/GetArgumentHandler';
import { GetArgumentChainHandler } from '../../application/handlers/GetArgumentChainHandler';

// Infrastructure
import { ObjectStorage } from '../../infrastructure/storage/ObjectStorage';
import { FileArgumentRepository } from '../../infrastructure/storage/FileArgumentRepository';
import { FileSimulationRepository } from '../../infrastructure/storage/FileSimulationRepository';
import { FileAgentRepository } from '../../infrastructure/storage/FileAgentRepository';
import { InMemoryEventBus } from '../../infrastructure/events/InMemoryEventBus';
import { StructuredLogger } from '../../infrastructure/logging/StructuredLogger';
import { HashResolver } from '../../infrastructure/storage/HashResolver';

export function configureContainer(): typeof container {
  // Core services (no dependencies)
  container.register(TOKENS.ArgumentValidator, { useClass: ArgumentValidator });
  container.register(TOKENS.RelationshipBuilder, { useClass: RelationshipBuilder });
  container.register(TOKENS.VoteCalculator, { useClass: VoteCalculator });

  // Infrastructure
  container.register(TOKENS.ObjectStorage, {
    useFactory: () => new ObjectStorage('.townhall')
  });
  container.register(TOKENS.HashResolver, { useClass: HashResolver });
  container.register(TOKENS.ArgumentRepository, { useClass: FileArgumentRepository });
  container.register(TOKENS.SimulationRepository, { useClass: FileSimulationRepository });
  container.register(TOKENS.AgentRepository, { useClass: FileAgentRepository });
  container.register(TOKENS.EventBus, { useClass: InMemoryEventBus });
  container.register(TOKENS.Logger, {
    useFactory: () => new StructuredLogger({ component: 'townhall-cli' })
  });

  // Application layer - handlers
  container.register(TOKENS.InitializeDebateHandler, { useClass: InitializeDebateHandler });
  container.register(TOKENS.CreateArgumentHandler, { useClass: CreateArgumentHandler });
  container.register(TOKENS.GetDebateHistoryHandler, { useClass: GetDebateHistoryHandler });
  container.register(TOKENS.SubmitRebuttalHandler, { useClass: SubmitRebuttalHandler });
  container.register(TOKENS.SubmitConcessionHandler, { useClass: SubmitConcessionHandler });
  container.register(TOKENS.VoteToCloseHandler, { useClass: VoteToCloseHandler });
  container.register(TOKENS.GetArgumentHandler, { useClass: GetArgumentHandler });
  container.register(TOKENS.GetArgumentChainHandler, { useClass: GetArgumentChainHandler });

  // Application layer - buses with handler registration
  container.register(TOKENS.CommandBus, {
    useFactory: () => {
      const commandBus = new CommandBus();
      // Register command handlers
      commandBus.register('InitializeDebateCommand', container.resolve(TOKENS.InitializeDebateHandler));
      commandBus.register('CreateArgumentCommand', container.resolve(TOKENS.CreateArgumentHandler));
      commandBus.register('SubmitRebuttalCommand', container.resolve(TOKENS.SubmitRebuttalHandler));
      commandBus.register('SubmitConcessionCommand', container.resolve(TOKENS.SubmitConcessionHandler));
      commandBus.register('VoteToCloseCommand', container.resolve(TOKENS.VoteToCloseHandler));
      return commandBus;
    }
  });

  container.register(TOKENS.QueryBus, {
    useFactory: () => {
      const queryBus = new QueryBus();
      // Register query handlers
      queryBus.register('GetDebateHistoryQuery', container.resolve(TOKENS.GetDebateHistoryHandler));
      queryBus.register('GetArgumentQuery', container.resolve(TOKENS.GetArgumentHandler));
      queryBus.register('GetArgumentChainQuery', container.resolve(TOKENS.GetArgumentChainHandler));
      return queryBus;
    }
  });

  return container;
}