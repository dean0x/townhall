/**
 * ARCHITECTURE: Dependency Injection container re-exports
 * Pattern: Re-exports from tokens.ts for centralized access
 * Rationale: Single source of truth for DI tokens
 *
 * For injection tokens, prefer importing from './tokens' directly.
 * For container configuration, see interfaces/cli/container-config.ts.
 */

import 'reflect-metadata';
import { container } from 'tsyringe';

// Re-export Tokens from tokens.ts (single source of truth)
export { Tokens } from './tokens';

// Container instance for global access
export { container };