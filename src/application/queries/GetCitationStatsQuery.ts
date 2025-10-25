/**
 * GetCitationStatsQuery - Query to get citation statistics for a simulation
 *
 * Returns aggregated statistics about citations in the current simulation.
 */

export interface GetCitationStatsQuery {
  readonly simulationId: string;
}

/**
 * Citation statistics result
 */
export interface CitationStats {
  readonly totalCitations: number;
  readonly peerReviewedCount: number;
  readonly peerReviewedPercentage: number;
  readonly citationsByType: Record<string, number>;
  readonly mostReferencedCitations: Array<{
    readonly citationId: string;
    readonly source: string;
    readonly usageCount: number;
  }>;
}
