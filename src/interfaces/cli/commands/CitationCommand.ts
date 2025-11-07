/**
 * ARCHITECTURE: Interface layer - Citation command
 * Pattern: Command adapter with Result-based error handling
 * Rationale: Enables agents to create and manage citations
 */

import { Command, Option } from 'commander';
import { BaseCommand, CommandContext } from '../base/BaseCommand';
import { Result, ok, err } from '../../../shared/result';
import { DomainError, ValidationError } from '../../../shared/errors';
import { ICommandBus } from '../../../application/handlers/CommandBus';
import { IQueryBus } from '../../../application/handlers/QueryBus';
import { CreateCitationCommand } from '../../../application/commands/CreateCitationCommand';
import { GetCitationStatsQuery } from '../../../application/queries/GetCitationStatsQuery';
import { CitationType } from '../../../core/value-objects/CitationType';
import { SimulationId } from '../../../core/value-objects/SimulationId';

interface CitationOptions {
  source: string;
  type: CitationType;
  doi?: string;
  url?: string;
  page?: number;
  quote?: string;
  authors?: string;
  year?: number;
  list?: boolean;
  stats?: boolean;
}

interface ValidatedCitationOptions {
  source: string;
  type: CitationType;
  doi?: string;
  url?: string;
  page?: number;
  quote?: string;
  authors?: string[];
  year?: number;
}

export class CitationCommand extends BaseCommand {
  constructor(
    private readonly commandBus: ICommandBus,
    private readonly queryBus: IQueryBus,
    context: CommandContext
  ) {
    super('citation', 'Create or manage citations for arguments', context);
  }

  protected setupOptions(command: Command): void {
    command
      // Citation creation options
      .option('--source <source>', 'Citation source (title, name)')
      .addOption(
        new Option('--type <type>', 'Citation type')
          .choices(['paper', 'report', 'book', 'website', 'study'])
      )
      .option('--doi <doi>', 'Digital Object Identifier')
      .option('--url <url>', 'Web URL')
      .option('--page <number>', 'Page number', parseInt)
      .option('--quote <quote>', 'Direct quote from source')
      .option('--authors <authors>', 'Comma-separated list of authors')
      .option('--year <year>', 'Publication year', parseInt)

      // Query options
      .option('--list', 'List all citations in current simulation')
      .option('--stats', 'Show citation statistics for current simulation');
  }

  protected validateOptions(options: CitationOptions): Result<ValidatedCitationOptions, ValidationError> {
    // If listing or showing stats, no validation needed
    if (options.list || options.stats) {
      return ok({ list: options.list, stats: options.stats } as ValidatedCitationOptions);
    }

    // For creating citations, source and type are required
    if (!options.source || options.source.trim().length === 0) {
      return err(new ValidationError('--source is required'));
    }

    if (!options.type) {
      return err(new ValidationError('--type is required (paper, report, book, website, study)'));
    }

    // Validate source length
    if (options.source.length > 500) {
      return err(new ValidationError('Source must be less than 500 characters'));
    }

    // Validate year if provided
    if (options.year !== undefined) {
      const currentYear = new Date().getFullYear();
      if (options.year < 1000 || options.year > currentYear + 1) {
        return err(new ValidationError(`Year must be between 1000 and ${currentYear + 1}`));
      }
    }

    // Validate page number
    if (options.page !== undefined && options.page < 1) {
      return err(new ValidationError('Page number must be positive'));
    }

    // Validate quote length
    if (options.quote && options.quote.length > 1000) {
      return err(new ValidationError('Quote must be less than 1000 characters'));
    }

    // Parse authors if provided
    const authors = options.authors
      ? options.authors.split(',').map(a => a.trim()).filter(a => a.length > 0)
      : undefined;

    return ok({
      source: options.source.trim(),
      type: options.type,
      doi: options.doi,
      url: options.url,
      page: options.page,
      quote: options.quote,
      authors,
      year: options.year,
    });
  }

  protected async execute(validatedOptions: ValidatedCitationOptions): Promise<Result<void, DomainError>> {
    const rawOptions = validatedOptions as unknown as CitationOptions;

    // Handle --list option
    if (rawOptions.list) {
      return this.listCitations();
    }

    // Handle --stats option
    if (rawOptions.stats) {
      return this.showStats();
    }

    // Create citation
    return this.createCitation(validatedOptions);
  }

  private async createCitation(options: ValidatedCitationOptions): Promise<Result<void, DomainError>> {
    this.context.logger.info('Creating citation', {
      source: options.source,
      type: options.type,
    });

    const command: CreateCitationCommand = {
      source: options.source,
      type: options.type,
      doi: options.doi,
      url: options.url,
      page: options.page,
      quote: options.quote,
      authors: options.authors,
      year: options.year,
    };

    const result = await this.commandBus.execute(command, 'CreateCitationCommand');

    if (result.isErr()) {
      return err(result.error);
    }

    const citationId = result.value;
    const shortId = citationId.substring(0, 7);

    this.displaySuccess('Citation created', {
      'ID': `${citationId.slice(0, 12)}... (short: ${shortId})`,
      'Source': options.source,
      'Type': options.type,
      'DOI': options.doi || '—',
      'Year': options.year?.toString() || '—',
      'Quote': options.quote ? `"${options.quote.substring(0, 50)}${options.quote.length > 50 ? '...' : ''}"` : '—',
    });

    this.context.logger.info('Citation created successfully', {
      citationId,
      source: options.source,
    });

    return ok(undefined);
  }

  private async listCitations(): Promise<Result<void, DomainError>> {
    // Get active simulation ID
    const simulationId = await this.getCurrentSimulationId();
    if (!simulationId) {
      return err(new ValidationError('No active simulation. Use "townhall simulate" first.'));
    }

    // Query for all citations
    const query = { simulationId };
    const result = await this.queryBus.execute(query, 'GetCitationStatsQuery');

    if (result.isErr()) {
      return err(result.error);
    }

    const stats = result.value;

    if (stats.totalCitations === 0) {
      console.log('\nNo citations in current simulation.');
      return ok(undefined);
    }

    console.log(`\nCitations in current simulation (${stats.totalCitations} total):\n`);

    // Display most referenced citations
    if (stats.mostReferencedCitations.length > 0) {
      for (const citation of stats.mostReferencedCitations) {
        console.log(`  ${citation.citationId} - ${citation.source}`);
        console.log(`    Referenced: ${citation.usageCount} time(s)\n`);
      }
    }

    return ok(undefined);
  }

  private async showStats(): Promise<Result<void, DomainError>> {
    // Get active simulation ID
    const simulationId = await this.getCurrentSimulationId();
    if (!simulationId) {
      return err(new ValidationError('No active simulation. Use "townhall simulate" first.'));
    }

    const query = { simulationId };
    const result = await this.queryBus.execute(query, 'GetCitationStatsQuery');

    if (result.isErr()) {
      return err(result.error);
    }

    const stats = result.value;

    console.log('\nCitation Statistics:\n');
    console.log(`  Total citations: ${stats.totalCitations}`);
    console.log(`  Peer-reviewed: ${stats.peerReviewedCount} (${stats.peerReviewedPercentage}%)\n`);

    if (Object.keys(stats.citationsByType).length > 0) {
      console.log('  Citations by type:');
      for (const [type, count] of Object.entries(stats.citationsByType)) {
        console.log(`    ${type}: ${count}`);
      }
      console.log();
    }

    if (stats.mostReferencedCitations.length > 0) {
      console.log('  Most referenced:');
      for (const citation of stats.mostReferencedCitations.slice(0, 3)) {
        console.log(`    ${citation.citationId} - ${citation.source} (${citation.usageCount} uses)`);
      }
    }

    return ok(undefined);
  }

  private async getCurrentSimulationId(): Promise<string | null> {
    // This would typically come from a simulation context or repository
    // For now, return a placeholder
    // TODO: Implement proper simulation context retrieval
    return 'current-sim-id';
  }
}
