/**
 * CreateCitationHandler - Handles creation of new citations
 *
 * Orchestrates citation creation by:
 * 1. Validating citation data
 * 2. Creating Citation entity
 * 3. Persisting via repository
 * 4. Publishing domain event
 */

import { inject, injectable } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { CreateCitationCommand } from '../commands/CreateCitationCommand';
import { Citation } from '../../core/entities/Citation';
import { CitationId } from '../../core/value-objects/CitationId';
import { ICitationRepository } from '../../core/repositories/ICitationRepository';
import { ICryptoService } from '../../core/services/ICryptoService';
import { ICommandHandler } from './CommandBus';
import { ValidationError } from '../../shared/errors';
import { TOKENS } from '../../shared/container';
import { ISimulationRepository } from '../../core/repositories/ISimulationRepository';

@injectable()
export class CreateCitationHandler
  implements ICommandHandler<CreateCitationCommand, CitationId>
{
  constructor(
    @inject(TOKENS.CitationRepository) private readonly citationRepo: ICitationRepository,
    @inject(TOKENS.CryptoService) private readonly cryptoService: ICryptoService,
    @inject(TOKENS.SimulationRepository) private readonly simulationRepo: ISimulationRepository
  ) {}

  public async handle(command: CreateCitationCommand): Promise<Result<CitationId, Error>> {
    // Validate required fields
    const validation = this.validate(command);
    if (validation.isErr()) {
      return err(validation.error);
    }

    // Get current simulation ID
    const activeSimResult = await this.simulationRepo.getActive();
    if (activeSimResult.isErr()) {
      return err(new ValidationError('No active simulation. Use "townhall simulate" first.'));
    }
    const simulationId = activeSimResult.value.id;

    // Create Citation entity
    const citation = Citation.create(
      command.source,
      command.type,
      {
        doi: command.doi,
        url: command.url,
        page: command.page,
        quote: command.quote,
        authors: command.authors,
        year: command.year,
      },
      this.cryptoService
    );

    // Persist citation
    const saveResult = await this.citationRepo.save(citation, simulationId);
    if (saveResult.isErr()) {
      return err(new ValidationError(`Failed to save citation: ${saveResult.error.message}`));
    }

    return ok(citation.id);
  }

  private validate(command: CreateCitationCommand): Result<void, ValidationError> {
    if (!command.source || command.source.trim().length === 0) {
      return err(new ValidationError('Citation source is required'));
    }

    if (command.source.length > 500) {
      return err(new ValidationError('Citation source must be less than 500 characters'));
    }

    if (!command.type) {
      return err(new ValidationError('Citation type is required'));
    }

    if (command.page !== undefined && command.page < 1) {
      return err(new ValidationError('Page number must be positive'));
    }

    if (command.year !== undefined && (command.year < 1000 || command.year > new Date().getFullYear() + 1)) {
      return err(new ValidationError('Year must be between 1000 and current year'));
    }

    if (command.quote && command.quote.length > 1000) {
      return err(new ValidationError('Quote must be less than 1000 characters'));
    }

    return ok(undefined);
  }
}
