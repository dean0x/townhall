/**
 * ARCHITECTURE: Dependency Injection container configuration
 * Pattern: Re-exports from tokens.ts for centralized access
 * Rationale: Single source of truth for DI tokens
 *
 * For injection tokens, prefer importing from './tokens' directly.
 */

import 'reflect-metadata';
import { container } from 'tsyringe';

// Re-export Tokens from tokens.ts (single source of truth)
export { Tokens } from './tokens';

// Container instance for global access
export { container };

// Helper function to configure the container
export const configureContainer = (): void => {
  // Configuration will be done during infrastructure setup
  // This is just the foundation
};