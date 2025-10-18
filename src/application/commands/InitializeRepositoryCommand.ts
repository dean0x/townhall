/**
 * ARCHITECTURE: Application layer command
 * Pattern: Command represents user intent to initialize repository
 * Rationale: Decouples CLI from infrastructure layer
 */

export interface InitializeRepositoryCommand {
  readonly force: boolean;
}
