/**
 * ARCHITECTURE: Application layer query handler for argument chains
 * Pattern: Query handler with recursive traversal
 * Rationale: Builds complete argument chains for analysis
 */

import { injectable, inject } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { NotFoundError } from '../../shared/errors';
import { IQueryHandler } from './QueryBus';
import { GetArgumentChainQuery } from '../queries/GetArgumentChainQuery';
import { IArgumentRepository } from '../../core/repositories/IArgumentRepository';
import { Argument } from '../../core/entities/Argument';
import { TOKENS } from '../../shared/container';

export interface ArgumentNode {
  readonly argument: Argument;
  readonly children: ArgumentNode[];
  readonly metadata?: {
    readonly depth: number;
    readonly type: string;
    readonly agentId: string;
  };
}

export interface GetArgumentChainResult {
  readonly root: ArgumentNode;
  readonly totalArguments: number;
  readonly maxDepthReached: number;
}

@injectable()
export class GetArgumentChainHandler implements IQueryHandler<GetArgumentChainQuery, GetArgumentChainResult> {
  constructor(
    @inject(TOKENS.ArgumentRepository) private readonly argumentRepo: IArgumentRepository
  ) {}

  public async handle(query: GetArgumentChainQuery): Promise<Result<GetArgumentChainResult, NotFoundError>> {
    // Retrieve root argument
    const rootResult = await this.argumentRepo.findById(query.rootArgumentId);
    if (rootResult.isErr()) {
      return err(new NotFoundError('Root argument', query.rootArgumentId));
    }

    const root = rootResult.value;
    const maxDepth = Math.min(query.maxDepth || 10, 100);

    // Build argument chain recursively
    const chainResult = await this.buildChain(root, 0, maxDepth, query.includeMetadata || false);
    if (chainResult.isErr()) {
      return err(chainResult.error);
    }

    const rootNode = chainResult.value;

    // Calculate statistics
    const stats = this.calculateStats(rootNode);

    return ok({
      root: rootNode,
      totalArguments: stats.total,
      maxDepthReached: stats.maxDepth,
    });
  }

  private async buildChain(
    argument: Argument,
    currentDepth: number,
    maxDepth: number,
    includeMetadata: boolean
  ): Promise<Result<ArgumentNode, NotFoundError>> {
    const node: ArgumentNode = {
      argument,
      children: [],
      ...(includeMetadata ? {
        metadata: {
          depth: currentDepth,
          type: argument.type,
          agentId: argument.agentId,
        }
      } : {})
    };

    // Stop if max depth reached
    if (currentDepth >= maxDepth) {
      return ok(node);
    }

    // Find related arguments
    const relationshipsResult = await this.argumentRepo.findRelationships(argument.id);
    if (relationshipsResult.isErr()) {
      return ok(node); // Return node without children if relationships can't be found
    }

    const relationships = relationshipsResult.value;
    const childIds = [
      ...(relationships.rebuttals || []),
      ...(relationships.supports || []),
    ];

    // Build child nodes in parallel
    const childResults = await Promise.all(
      childIds.map(childId => this.argumentRepo.findById(childId))
    );

    const childNodes = await Promise.all(
      childResults
        .filter(result => result.isOk())
        .map(result => this.buildChain(
          result.value,
          currentDepth + 1,
          maxDepth,
          includeMetadata
        ))
    );

    node.children.push(...childNodes.filter(r => r.isOk()).map(r => r.value));

    return ok(node);
  }

  private calculateStats(node: ArgumentNode): { total: number; maxDepth: number } {
    let total = 1;
    let maxDepth = 0;

    const traverse = (n: ArgumentNode, depth: number): void => {
      maxDepth = Math.max(maxDepth, depth);
      for (const child of n.children) {
        total++;
        traverse(child, depth + 1);
      }
    };

    traverse(node, 0);
    return { total, maxDepth };
  }
}