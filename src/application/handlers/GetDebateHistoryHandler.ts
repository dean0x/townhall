/**
 * ARCHITECTURE: Application layer query handler
 * Pattern: Read-only handler with multiple data sources
 * Rationale: Provides complex read operations with relationship data
 */

import { injectable, inject } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { IQueryHandler } from './QueryBus';
import { GetDebateHistoryQuery } from '../queries/GetDebateHistoryQuery';
import { ISimulationRepository } from '../../core/repositories/ISimulationRepository';
import { IArgumentRepository } from '../../core/repositories/IArgumentRepository';
import { IAgentRepository } from '../../core/repositories/IAgentRepository';
import { RelationshipBuilder, ArgumentRelationship } from '../../core/services/RelationshipBuilder';
import { Argument } from '../../core/entities/Argument';
import { Rebuttal } from '../../core/entities/Rebuttal';
import { Concession } from '../../core/entities/Concession';
import { TOKENS } from '../../shared/container';

export interface ArgumentSummary {
  readonly id: string;
  readonly shortHash: string;
  readonly agentName: string;
  readonly type: string;
  readonly preview: string;
  readonly timestamp: string;
  readonly sequenceNumber: number;
}

export interface DebateHistoryResult {
  readonly simulationId: string;
  readonly topic: string;
  readonly status: string;
  readonly arguments: ArgumentSummary[];
  readonly relationships?: ArgumentRelationship[];
  readonly participantCount: number;
  readonly argumentCount: number;
}

@injectable()
export class GetDebateHistoryHandler implements IQueryHandler<GetDebateHistoryQuery, DebateHistoryResult> {
  constructor(
    @inject(TOKENS.SimulationRepository) private readonly simulationRepo: ISimulationRepository,
    @inject(TOKENS.ArgumentRepository) private readonly argumentRepo: IArgumentRepository,
    @inject(TOKENS.AgentRepository) private readonly agentRepo: IAgentRepository,
    @inject(TOKENS.RelationshipBuilder) private readonly relationshipBuilder: RelationshipBuilder
  ) {}

  public async handle(query: GetDebateHistoryQuery): Promise<Result<DebateHistoryResult, Error>> {
    // Get simulation (active if not specified)
    let simulation;
    if (query.simulationId) {
      const simResult = await this.simulationRepo.findById(query.simulationId);
      if (simResult.isErr()) {
        return simResult;
      }
      simulation = simResult.value;
    } else {
      const activeResult = await this.simulationRepo.getActive();
      if (activeResult.isErr()) {
        // No active debate - return empty result
        return ok({
          simulationId: '',
          topic: 'No active debate',
          status: 'inactive',
          arguments: [],
          relationships: undefined,
          participantCount: 0,
          argumentCount: 0,
        });
      }
      simulation = activeResult.value;
    }

    // Get arguments for simulation
    const argumentsResult = await this.argumentRepo.findBySimulation(simulation.id);
    if (argumentsResult.isErr()) {
      return argumentsResult;
    }

    let argumentList = argumentsResult.value;

    // Apply filters
    if (query.agentFilter) {
      argumentList = argumentList.filter(arg => arg.agentId === query.agentFilter);
    }

    if (query.typeFilter) {
      argumentList = argumentList.filter(arg => arg.type === query.typeFilter);
    }

    // Sort by sequence number (chronological order)
    argumentList.sort((a, b) => a.metadata.sequenceNumber - b.metadata.sequenceNumber);

    // Apply limit
    if (query.limit && query.limit > 0) {
      argumentList = argumentList.slice(0, query.limit);
    }

    // Build argument summaries
    const argumentSummaries = await this.buildArgumentSummaries(argumentList);

    // Build relationships if requested
    let relationships: ArgumentRelationship[] | undefined;
    if (query.includeRelationships) {
      relationships = this.buildRelationships(argumentList);
    }

    return ok({
      simulationId: simulation.id,
      topic: simulation.topic,
      status: simulation.status,
      arguments: argumentSummaries,
      relationships,
      participantCount: simulation.getParticipantCount(),
      argumentCount: simulation.getArgumentCount(),
    });
  }

  private async buildArgumentSummaries(argumentList: Argument[]): Promise<ArgumentSummary[]> {
    const agentIds = [...new Set(argumentList.map(arg => arg.agentId))];
    const agentResults = await Promise.all(
      agentIds.map(id => this.agentRepo.findById(id))
    );

    const agentMap = new Map<string, string>();
    agentResults.forEach((result, index) => {
      agentMap.set(agentIds[index], result.isOk() ? result.value.name : 'Unknown Agent');
    });

    return argumentList.map(argument => {
      const agentName = agentMap.get(argument.agentId) || 'Unknown Agent';
      const preview = argument.content.text.length > 100 ?
        argument.content.text.substring(0, 100) + '...' :
        argument.content.text;

      return {
        id: argument.id,
        shortHash: argument.metadata.shortHash,
        agentName,
        type: argument.type,
        preview,
        timestamp: argument.timestamp,
        sequenceNumber: argument.metadata.sequenceNumber,
      };
    });
  }

  private buildRelationships(argumentList: Argument[]): ArgumentRelationship[] {
    const relationships: ArgumentRelationship[] = [];

    for (const argument of argumentList) {
      if (argument instanceof Rebuttal) {
        relationships.push({
          fromId: argument.id,
          toId: argument.targetArgumentId,
          type: 'rebuts',
        });
      } else if (argument instanceof Concession) {
        relationships.push({
          fromId: argument.id,
          toId: argument.targetArgumentId,
          type: 'concedes_to',
        });
      }
    }

    return relationships;
  }
}