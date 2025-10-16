/**
 * ARCHITECTURE: Interface layer - Log command (refactored)
 * Pattern: Query adapter with Result-based error handling
 * Rationale: Separates query logic from presentation with proper error propagation
 */

import { Command, Option } from 'commander';
import { BaseCommand, CommandContext } from '../base/BaseCommand';
import { Result, ok, err } from '../../../shared/result';
import { DomainError, ValidationError } from '../../../shared/errors';
import { IQueryBus } from '../../../application/handlers/QueryBus';
import { GetDebateHistoryQuery } from '../../../application/queries/GetDebateHistoryQuery';
import { ArgumentType } from '../../../core/value-objects/ArgumentType';
import { AgentIdGenerator, AgentId } from '../../../core/value-objects/AgentId';

interface LogOptions {
  graph?: boolean;
  agent?: string;
  type?: ArgumentType;
  limit?: string;
  json?: boolean;
}

interface ValidatedLogOptions {
  agentFilter?: AgentId;
  typeFilter?: ArgumentType;
  limit?: number;
  includeRelationships: boolean;
  jsonOutput: boolean;
}

export class LogCommand extends BaseCommand {
  constructor(
    private readonly queryBus: IQueryBus,
    context: CommandContext
  ) {
    super('log', 'View debate history with various formatting options', context);
  }

  protected setupOptions(command: Command): void {
    command
      .option('--graph', 'Show argument relationships as tree')
      .option('--agent <uuid>', 'Filter by specific agent')
      .addOption(new Option('--type <type>', 'Filter by argument type').choices(['deductive', 'inductive', 'empirical']))
      .option('--limit <number>', 'Limit number of entries')
      .option('--json', 'Output as JSON');
  }

  protected validateOptions(options: LogOptions): Result<ValidatedLogOptions, ValidationError> {
    // Validate agent ID if provided
    let agentFilter: AgentId | undefined;
    if (options.agent) {
      const agentIdResult = this.validateAgentId(options.agent);
      if (agentIdResult.isErr()) {
        return err(agentIdResult.error);
      }
      agentFilter = agentIdResult.value;
    }

    // Validate limit if provided
    let limit: number | undefined;
    if (options.limit) {
      const limitResult = this.validateLimit(options.limit);
      if (limitResult.isErr()) {
        return err(limitResult.error);
      }
      limit = limitResult.value;
    }

    return ok({
      agentFilter,
      typeFilter: options.type,
      limit,
      includeRelationships: options.graph || false,
      jsonOutput: options.json || false,
    });
  }

  protected async execute(validatedOptions: ValidatedLogOptions): Promise<Result<void, DomainError>> {
    this.context.logger.info('Retrieving debate history', {
      options: validatedOptions,
    });

    // Build query
    const query: GetDebateHistoryQuery = {
      agentFilter: validatedOptions.agentFilter,
      typeFilter: validatedOptions.typeFilter,
      limit: validatedOptions.limit,
      includeRelationships: validatedOptions.includeRelationships,
    };

    const result = await this.queryBus.execute(query, 'GetDebateHistoryQuery');

    if (result.isErr()) {
      return err(result.error);
    }

    const history = result.value;

    // Display results
    if (validatedOptions.jsonOutput) {
      console.log(JSON.stringify(history, null, 2));
    } else {
      this.displayHistory(history, validatedOptions);
    }

    this.context.logger.info('Debate history displayed', {
      argumentCount: history.argumentCount,
      participantCount: history.participantCount,
    });

    return ok(undefined);
  }

  private validateAgentId(agentId: string): Result<AgentId, ValidationError> {
    return AgentIdGenerator.fromString(agentId);
  }

  private validateLimit(limitStr: string): Result<number, ValidationError> {
    const limit = parseInt(limitStr, 10);
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return err(new ValidationError(
        'Limit must be a number between 1 and 1000',
        'limit'
      ));
    }
    return ok(limit);
  }

  private displayHistory(history: any, options: ValidatedLogOptions): void {
    console.log(`Debate: ${history.topic} [${history.status}]`);
    console.log(`Participants: ${history.participantCount} | Arguments: ${history.argumentCount}`);
    console.log('');

    if (history.arguments.length === 0) {
      console.log('No arguments yet. Submit the first argument with:');
      console.log('  townhall argument --agent <agent-id> --type <type> ...');
      return;
    }

    if (options.includeRelationships && history.relationships) {
      this.displayGraphView(history);
    } else {
      this.displayListView(history);
    }
  }

  private displayListView(history: any): void {
    history.arguments.forEach((arg: any, index: number) => {
      const timestamp = new Date(arg.timestamp).toLocaleString();
      console.log(`${index + 1}. [${arg.shortHash}] ${arg.agentName} (${arg.type}) - ${timestamp}`);
      console.log(`   "${arg.preview}"`);
      console.log('');
    });
  }

  private displayGraphView(history: any): void {
    // Simple tree representation
    const relationshipMap = new Map<string, string[]>();

    // Build relationship map
    history.relationships?.forEach((rel: any) => {
      if (!relationshipMap.has(rel.toId)) {
        relationshipMap.set(rel.toId, []);
      }
      relationshipMap.get(rel.toId)!.push(rel.fromId);
    });

    // Find root arguments (those not referenced by others)
    const referencedIds = new Set(history.relationships?.map((r: any) => r.fromId) || []);
    const rootArguments = history.arguments.filter((arg: any) => !referencedIds.has(arg.id));

    // Display each root and its children
    rootArguments.forEach((root: any) => {
      this.displayArgumentTree(root, history.arguments, relationshipMap, 0);
    });
  }

  private displayArgumentTree(
    argument: any,
    allArguments: any[],
    relationshipMap: Map<string, string[]>,
    depth: number
  ): void {
    const indent = '  '.repeat(depth);
    const prefix = depth === 0 ? '' : '└── ';

    console.log(`${indent}${prefix}${argument.shortHash} (${argument.agentName}: ${argument.type})`);

    // Find and display children
    const childIds = relationshipMap.get(argument.id) || [];
    childIds.forEach(childId => {
      const childArg = allArguments.find(a => a.id === childId);
      if (childArg) {
        this.displayArgumentTree(childArg, allArguments, relationshipMap, depth + 1);
      }
    });
  }
}