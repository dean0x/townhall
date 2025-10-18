/**
 * ARCHITECTURE: Application layer command
 * Pattern: Command represents user intent
 * Rationale: Decouples user interface from business logic
 */

export interface InitializeDebateCommand {
  readonly topic: string;
}