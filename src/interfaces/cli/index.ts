#!/usr/bin/env node

/**
 * ARCHITECTURE: Interface layer - CLI entry point
 * Pattern: Thin adapter layer over application services
 * Rationale: CLI is just one interface to the application core
 */

import 'reflect-metadata';
import { TownhallCLI } from './TownhallCLI';
import { configureContainer } from './container-config';

async function main(): Promise<void> {
  try {
    // Configure dependency injection
    const container = configureContainer();

    // Create and run CLI
    const cli = container.resolve(TownhallCLI);
    await cli.run(process.argv);
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Only run if this file is being executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}