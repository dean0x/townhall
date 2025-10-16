/**
 * ARCHITECTURE: Interface layer - Show command
 * Pattern: Query command with detailed output formatting
 * Rationale: Displays detailed argument information with relationships
 */

import { Command } from 'commander';
import { BaseCommand, CommandContext } from '../base/BaseCommand';
import { Result, ok, err } from '../../../shared/result';
import { DomainError, ValidationError } from '../../../shared/errors';
import { IQueryBus } from '../../../application/handlers/QueryBus';
import { GetArgumentQuery } from '../../../application/queries/GetArgumentQuery';
import { ArgumentId } from '../../../core/value-objects/ArgumentId';
import { DeductiveStructure, InductiveStructure, EmpiricalStructure } from '../../../core/entities/Argument';

interface ShowOptions {
  argumentId: string;
}

interface ValidatedShowOptions {
  argumentId: ArgumentId;
}

export class ShowCommand extends BaseCommand {
  constructor(
    private readonly queryBus: IQueryBus,
    context: CommandContext
  ) {
    super('show', 'Display detailed information about an argument', context);
  }

  protected setupOptions(command: Command): void {
    command
      .argument('<argument-id>', 'Full argument ID (64-char hash) to display');
  }

  protected validateOptions(rawOptions: any): Result<ValidatedShowOptions, ValidationError> {
    // Extract argument ID from first positional argument
    const argumentId = typeof rawOptions === 'string' ? rawOptions : (rawOptions as any)?.argumentId;

    if (!argumentId || typeof argumentId !== 'string' || argumentId.trim().length === 0) {
      return err(new ValidationError(
        'Argument ID is required',
        'argumentId'
      ));
    }

    return ok({
      argumentId: argumentId.trim() as ArgumentId,
    });
  }

  protected async execute(validatedOptions: ValidatedShowOptions): Promise<Result<void, DomainError>> {
    this.context.logger.info('Retrieving argument details', {
      argumentId: validatedOptions.argumentId,
    });

    const query: GetArgumentQuery = {
      argumentId: validatedOptions.argumentId,
      includeRelationships: true,
    };

    const result = await this.queryBus.execute(query, 'GetArgumentQuery');

    if (result.isErr()) {
      return err(result.error);
    }

    const { argument, relationships } = result.value;

    // Display argument details
    console.log('');
    console.log(`Argument: ${argument.metadata.shortHash}`);
    console.log(`Full ID: ${argument.id}`);
    console.log('');
    console.log(`Agent: ${argument.agentId}`);
    console.log(`Type: ${argument.type}`);
    console.log(`Sequence: #${argument.metadata.sequenceNumber}`);
    console.log(`Created: ${new Date(argument.timestamp).toLocaleString()}`);
    console.log('');

    // Display content based on type
    console.log('Content:');
    console.log('');

    switch (argument.type) {
      case 'deductive': {
        const structure = argument.content.structure as DeductiveStructure;
        console.log('  Premises:');
        structure.premises.forEach((premise, i) => {
          console.log(`    ${i + 1}. ${premise}`);
        });
        console.log('');
        console.log(`  Conclusion: ${structure.conclusion}`);
        if (structure.form) {
          console.log(`  Form: ${structure.form}`);
        }
        break;
      }

      case 'inductive': {
        const structure = argument.content.structure as InductiveStructure;
        console.log('  Observations:');
        structure.observations.forEach((obs, i) => {
          console.log(`    ${i + 1}. ${obs}`);
        });
        console.log('');
        console.log(`  Generalization: ${structure.generalization}`);
        if (structure.confidence !== undefined) {
          console.log(`  Confidence: ${(structure.confidence * 100).toFixed(0)}%`);
        }
        break;
      }

      case 'empirical': {
        const structure = argument.content.structure as EmpiricalStructure;
        console.log(`  Claim: ${structure.claim}`);
        console.log('');
        console.log('  Evidence:');
        structure.evidence.forEach((ev, i) => {
          console.log(`    ${i + 1}. ${ev.source}`);
          console.log(`       Relevance: ${ev.relevance}`);
          if (ev.citation) {
            console.log(`       Citation: ${ev.citation}`);
          }
        });
        if (structure.methodology) {
          console.log('');
          console.log(`  Methodology: ${structure.methodology}`);
        }
        break;
      }
    }

    // Display full text if different from structure
    if (argument.content.text && argument.content.text.trim()) {
      console.log('');
      console.log('Full text:');
      console.log(`  ${argument.content.text}`);
    }

    // Display relationships
    if (relationships) {
      console.log('');
      console.log('Relationships:');

      if (relationships.rebuttals.length > 0) {
        console.log(`  Rebuttals (${relationships.rebuttals.length}):`);
        relationships.rebuttals.forEach(id => {
          console.log(`    - ${id}`);
        });
      }

      if (relationships.concessions.length > 0) {
        console.log(`  Concessions (${relationships.concessions.length}):`);
        relationships.concessions.forEach(id => {
          console.log(`    - ${id}`);
        });
      }

      if (relationships.supports.length > 0) {
        console.log(`  Supports (${relationships.supports.length}):`);
        relationships.supports.forEach(id => {
          console.log(`    - ${id}`);
        });
      }

      if (relationships.rebuttals.length === 0 &&
          relationships.concessions.length === 0 &&
          relationships.supports.length === 0) {
        console.log('  (no responses)');
      }
    }

    console.log('');

    this.context.logger.info('Argument details retrieved successfully', {
      argumentId: argument.id,
      type: argument.type,
    });

    return ok(undefined);
  }
}
