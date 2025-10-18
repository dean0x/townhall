/**
 * ARCHITECTURE: Interface layer - Trace command
 * Pattern: Query command with tree visualization
 * Rationale: Displays argument lineage and response chains
 */

import { Command } from 'commander';
import { BaseCommand, CommandContext } from '../base/BaseCommand';
import { Result, ok, err } from '../../../shared/result';
import { DomainError, ValidationError } from '../../../shared/errors';
import { IQueryBus } from '../../../application/handlers/QueryBus';
import { GetArgumentChainQuery } from '../../../application/queries/GetArgumentChainQuery';
import { ArgumentId } from '../../../core/value-objects/ArgumentId';

interface TraceOptions {
  argumentId: string;
  depth?: string;
}

interface ValidatedTraceOptions {
  argumentId: ArgumentId;
  maxDepth: number;
}

export class TraceCommand extends BaseCommand {
  constructor(
    private readonly queryBus: IQueryBus,
    context: CommandContext
  ) {
    super('trace', 'Trace argument response chain', context);
  }

  protected setupOptions(command: Command): void {
    command
      .argument('<argument-id>', 'Full argument ID (64-char hash) to trace')
      .option('--depth <number>', 'Maximum depth to traverse', '5');
  }

  protected validateOptions(rawOptions: unknown): Result<ValidatedTraceOptions, ValidationError> {
    // Extract argument ID from first positional argument
    let argumentId: string;
    let depth: string | undefined;

    if (typeof rawOptions === 'string') {
      // Just the argument ID passed
      argumentId = rawOptions;
    } else if (typeof rawOptions === 'object' && rawOptions !== null) {
      // Object with argumentId and options
      const opts = rawOptions as Record<string, unknown>;
      argumentId = (typeof opts.argumentId === 'string' ? opts.argumentId : '') || '';
      depth = typeof opts.depth === 'string' ? opts.depth : undefined;
    } else {
      argumentId = '';
    }

    if (!argumentId || argumentId.trim().length === 0) {
      return err(new ValidationError(
        'Argument ID is required',
        'argumentId'
      ));
    }

    // Validate depth
    const maxDepth = depth ? parseInt(depth, 10) : 5;
    if (isNaN(maxDepth) || maxDepth < 1 || maxDepth > 100) {
      return err(new ValidationError(
        'Depth must be a number between 1 and 100',
        'depth'
      ));
    }

    return ok({
      argumentId: argumentId.trim() as ArgumentId,
      maxDepth,
    });
  }

  protected async execute(validatedOptions: ValidatedTraceOptions): Promise<Result<void, DomainError>> {
    this.context.logger.info('Tracing argument chain', {
      argumentId: validatedOptions.argumentId,
      maxDepth: validatedOptions.maxDepth,
    });

    const query: GetArgumentChainQuery = {
      rootArgumentId: validatedOptions.argumentId,
      maxDepth: validatedOptions.maxDepth,
      includeMetadata: true,
    };

    const result = await this.queryBus.execute(query, 'GetArgumentChainQuery');

    if (result.isErr()) {
      return err(result.error);
    }

    const { root, totalArguments, maxDepthReached } = result.value;

    // Display trace header
    console.log('');
    console.log(`Argument Chain: ${root.argument.metadata.shortHash}`);
    console.log(`Total arguments: ${totalArguments} | Max depth: ${maxDepthReached}`);
    console.log('');

    // Display tree
    this.displayTree(root, '', true);

    console.log('');

    this.context.logger.info('Argument chain traced successfully', {
      argumentId: root.argument.id,
      totalArguments,
      maxDepthReached,
    });

    return ok(undefined);
  }

  private displayTree(node: any, prefix: string, isLast: boolean): void {
    const marker = isLast ? '└── ' : '├── ';
    const extension = isLast ? '    ' : '│   ';

    const shortHash = node.argument.metadata.shortHash;
    const agentId = node.metadata?.agentId || node.argument.agentId;
    const type = node.metadata?.type || node.argument.type;
    const created = new Date(node.argument.timestamp).toLocaleString();

    // Get the conclusion or text summary
    let summary = '';
    if (node.argument.content.structure.conclusion) {
      summary = node.argument.content.structure.conclusion;
    } else if (node.argument.content.structure.generalization) {
      summary = node.argument.content.structure.generalization;
    } else if (node.argument.content.structure.claim) {
      summary = node.argument.content.structure.claim;
    } else if (node.argument.content.text) {
      summary = node.argument.content.text;
    }

    // Truncate summary if too long
    if (summary.length > 60) {
      summary = summary.substring(0, 57) + '...';
    }

    console.log(`${prefix}${marker}[${shortHash}] ${agentId.substring(0, 8)} (${type})`);
    console.log(`${prefix}${extension}${summary}`);
    console.log(`${prefix}${extension}${created}`);

    // Display children
    const children = node.children || [];
    children.forEach((child: any, index: number) => {
      const isLastChild = index === children.length - 1;
      this.displayTree(child, prefix + extension, isLastChild);
    });
  }
}
