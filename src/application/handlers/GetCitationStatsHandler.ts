/**
 * GetCitationStatsHandler - Generates citation statistics for a simulation
 *
 * Aggregates data about citations including:
 * - Total count
 * - Peer-reviewed percentage
 * - Distribution by type
 * - Most referenced citations
 */

import { inject, injectable } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { GetCitationStatsQuery, CitationStats } from '../queries/GetCitationStatsQuery';
import { ICitationRepository } from '../../core/repositories/ICitationRepository';
import type { SimulationId } from '../../core/value-objects/SimulationId';
import { CitationType, isPeerReviewed } from '../../core/value-objects/CitationType';
import { IQueryHandler } from './QueryBus';
import { ValidationError } from '../../shared/errors';
import { TOKENS } from '../../shared/container';

@injectable()
export class GetCitationStatsHandler implements IQueryHandler<GetCitationStatsQuery, CitationStats> {
  constructor(
    @inject(TOKENS.CitationRepository) private readonly citationRepo: ICitationRepository
  ) {}

  public async handle(query: GetCitationStatsQuery): Promise<Result<CitationStats, Error>> {
    const simulationId = query.simulationId as SimulationId;

    // Get all citations for this simulation
    const citationsResult = await this.citationRepo.findBySimulation(simulationId);
    if (citationsResult.isErr()) {
      return err(new ValidationError(`Failed to retrieve citations: ${citationsResult.error.message}`));
    }

    const citations = citationsResult.value;

    // Calculate statistics
    const totalCitations = citations.length;
    const peerReviewedCount = citations.filter(c => isPeerReviewed(c.type)).length;
    const peerReviewedPercentage = totalCitations > 0
      ? Math.round((peerReviewedCount / totalCitations) * 100)
      : 0;

    // Group by type
    const citationsByType: Record<string, number> = {};
    for (const citation of citations) {
      const type = citation.type;
      citationsByType[type] = (citationsByType[type] || 0) + 1;
    }

    // Get usage counts and sort by most referenced
    const citationsWithUsage = await Promise.all(
      citations.map(async (citation) => {
        const usageResult = await this.citationRepo.getUsageCount(citation.id);
        const usageCount = usageResult.isOk() ? usageResult.value : 0;
        return {
          citation,
          usageCount,
        };
      })
    );

    // Sort by usage count descending and take top 5
    const mostReferenced = citationsWithUsage
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5)
      .map(item => ({
        citationId: item.citation.getShortId(),
        source: item.citation.source,
        usageCount: item.usageCount,
      }));

    const stats: CitationStats = {
      totalCitations,
      peerReviewedCount,
      peerReviewedPercentage,
      citationsByType,
      mostReferencedCitations: mostReferenced,
    };

    return ok(stats);
  }
}
