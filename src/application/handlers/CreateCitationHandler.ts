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
        ...(command.doi && { doi: command.doi }),
        ...(command.url && { url: command.url }),
        ...(command.page !== undefined && { page: command.page }),
        ...(command.quote && { quote: command.quote }),
        ...(command.authors && { authors: command.authors }),
        ...(command.year !== undefined && { year: command.year }),
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

    // Validate URL if provided
    if (command.url) {
      const urlValidation = this.validateUrl(command.url);
      if (urlValidation.isErr()) {
        return urlValidation;
      }
    }

    // Validate DOI if provided
    if (command.doi) {
      const doiValidation = this.validateDoi(command.doi);
      if (doiValidation.isErr()) {
        return doiValidation;
      }
    }

    return ok(undefined);
  }

  private validateUrl(url: string): Result<void, ValidationError> {
    try {
      const parsed = new URL(url);

      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return err(new ValidationError('URL must use http or https protocol'));
      }

      // Prevent localhost/private IPs to mitigate SSRF
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
      ) {
        return err(new ValidationError('URL cannot reference private network addresses'));
      }

      // Length check
      if (url.length > 2048) {
        return err(new ValidationError('URL must be less than 2048 characters'));
      }

      return ok(undefined);
    } catch (error) {
      return err(new ValidationError('Invalid URL format'));
    }
  }

  private validateDoi(doi: string): Result<void, ValidationError> {
    // DOI format: 10.XXXX/YYYY where XXXX is registrant, YYYY is suffix
    const doiPattern = /^10\.\d{4,}\/[^\s]+$/;

    if (!doiPattern.test(doi)) {
      return err(new ValidationError('Invalid DOI format. Expected: 10.XXXX/YYYY'));
    }

    if (doi.length > 256) {
      return err(new ValidationError('DOI must be less than 256 characters'));
    }

    return ok(undefined);
  }
}
