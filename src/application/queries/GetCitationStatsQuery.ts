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
 *
 * Provides quantitative analysis of citations in a simulation including
 * credibility metrics (peer-reviewed percentage) and usage patterns.
 */
export interface CitationStats {
  /** Total number of citations in the simulation */
  readonly totalCitations: number;

  /** Count of peer-reviewed citations (papers and studies only) */
  readonly peerReviewedCount: number;

  /** Percentage of citations that are peer-reviewed (0-100, rounded to nearest integer) */
  readonly peerReviewedPercentage: number;

  /** Distribution of citations by type (e.g., {"paper": 5, "website": 3}) */
  readonly citationsByType: Record<string, number>;

  /**
   * Top 5 most-referenced citations sorted by usage count descending
   * Usage count = number of arguments that reference this citation
   */
  readonly mostReferencedCitations: Array<{
    /** Short citation ID (7 characters, git-style) */
    readonly citationId: string;

    /** Citation source/title */
    readonly source: string;

    /** Number of arguments that reference this citation */
    readonly usageCount: number;
  }>;
}
