/**
 * ARCHITECTURE: Interface layer - Log command
 * Pattern: Query adapter with display formatting
 * Rationale: Separates query logic from presentation logic
 */

import { Command, Option } from 'commander';
import { IQueryBus } from '../../../application/handlers/QueryBus';
import { GetDebateHistoryQuery } from '../../../application/queries/GetDebateHistoryQuery';
import { ArgumentType } from '../../../core/value-objects/ArgumentType';
import { AgentIdGenerator } from '../../../core/value-objects/AgentId';
import { ILogger } from '../../../application/ports/ILogger';

interface LogOptions {
  graph?: boolean;
  agent?: string;
  type?: ArgumentType;
  limit?: number;
  json?: boolean;
}

export class LogCommand {
  constructor(
    private readonly queryBus: IQueryBus,
    private readonly logger: ILogger
  ) {}

  public build(): Command {
    return new Command('log')
      .description('View debate history with various formatting options')
      .option('--graph', 'Show argument relationships as tree')
      .option('--agent <uuid>', 'Filter by specific agent')
      .addOption(new Option('--type <type>', 'Filter by argument type').choices(['deductive', 'inductive', 'empirical']))
      .option('--limit <number>', 'Limit number of entries', parseInt)
      .option('--json', 'Output as JSON')
      .action(async (options: LogOptions) => {
        await this.execute(options);
      });
  }

  private async execute(options: LogOptions): Promise<void> {
    this.logger.info('Retrieving debate history', { options });

    try {
      // Build query
      const query: GetDebateHistoryQuery = {
        agentFilter: options.agent ? AgentIdGenerator.fromString(options.agent) : undefined,
        typeFilter: options.type,
        limit: options.limit,
        includeRelationships: options.graph || false,
      };

      const result = await this.queryBus.execute(query, 'GetDebateHistoryQuery');

      if (result.isErr()) {
        console.error('❌ Failed to retrieve debate history:', result.error.message);
        process.exit(1);
      }

      const history = result.value;

      if (options.json) {
        console.log(JSON.stringify(history, null, 2));
        return;
      }

      this.displayHistory(history, options);

      this.logger.info('Debate history displayed', {
        argumentCount: history.argumentCount,
        participantCount: history.participantCount,
      });

    } catch (error) {
      console.error('❌ Invalid input:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  private displayHistory(history: any, options: LogOptions): void {
    console.log(`Debate: ${history.topic} [${history.status}]`);
    console.log(`Participants: ${history.participantCount} | Arguments: ${history.argumentCount}`);
    console.log('');

    if (history.arguments.length === 0) {
      console.log('No arguments yet. Submit the first argument with:');
      console.log('  townhall argument --agent <agent-id> --type <type> ...');
      return;
    }

    if (options.graph && history.relationships) {
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