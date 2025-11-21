/**
 * ARCHITECTURE: Dependency Injection container configuration
 * Pattern: Re-exports from tokens.ts for backward compatibility
 * Rationale: Single source of truth for DI tokens with typed alternatives
 *
 * DEPRECATED: Prefer importing from './tokens' for new code.
 * Use Tokens (typed) for new code, TOKENS (symbols) for legacy compatibility.
 */

import 'reflect-metadata';
import { container } from 'tsyringe';

// Re-export TOKENS from tokens.ts (single source of truth)
export { TOKENS, Tokens } from './tokens';
export type { TokenType } from './tokens';

// Container instance for global access
export { container };

// Helper function to configure the container
export const configureContainer = (): void => {
  // Configuration will be done during infrastructure setup
  // This is just the foundation
};