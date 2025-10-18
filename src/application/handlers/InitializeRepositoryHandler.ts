/**
 * ARCHITECTURE: Application layer command handler
 * Pattern: Command handler with application port injection
 * Rationale: Depends on IStorageInitializer interface, not concrete implementation
 *
 * This handler initializes the repository structure through the application port,
 * maintaining hexagonal architecture principles by avoiding direct infrastructure dependencies.
 */

import { injectable, inject } from 'tsyringe';
import { Result } from '../../shared/result';
import { StorageError } from '../../shared/errors';
import { ICommandHandler } from './CommandBus';
import { InitializeRepositoryCommand } from '../commands/InitializeRepositoryCommand';
import { IStorageInitializer } from '../ports/IStorageInitializer';
import { TOKENS } from '../../shared/container';

@injectable()
export class InitializeRepositoryHandler implements ICommandHandler<InitializeRepositoryCommand, void> {
  constructor(
    @inject(TOKENS.StorageInitializer) private readonly storage: IStorageInitializer
  ) {}

  public async handle(command: InitializeRepositoryCommand): Promise<Result<void, StorageError>> {
    // For now, we ignore the force flag since ObjectStorage.initialize()
    // doesn't check if repository already exists
    // TODO: Add existence check if force=false behavior is needed

    return this.storage.initialize();
  }
}
