/**
 * ARCHITECTURE: Configuration for voting behavior
 * Pattern: Value object for voting rules
 * Rationale: Separates voting policy from mechanism
 */

/**
 * Configuration that determines how votes are counted
 * and when consensus is reached.
 */
export interface VotingRules {
  /**
   * If true, all participants must vote yes for consensus.
   * If false, majority (50%+1) is sufficient.
   */
  readonly requireUnanimity: boolean;

  /**
   * Minimum percentage of participants who must vote (0-1).
   * E.g., 0.75 means 75% must vote before consensus can be determined.
   */
  readonly minimumParticipation: number;

  /**
   * If true, participants can explicitly abstain.
   * Abstentions count toward participation but not toward yes/no.
   */
  readonly allowAbstention: boolean;
}

/**
 * Default voting rules: unanimous consent with full participation.
 */
export const DEFAULT_VOTING_RULES: VotingRules = {
  requireUnanimity: true,
  minimumParticipation: 1.0,
  allowAbstention: false,
};

/**
 * Majority voting rules: 50%+1 with minimum 75% participation.
 */
export const MAJORITY_VOTING_RULES: VotingRules = {
  requireUnanimity: false,
  minimumParticipation: 0.75,
  allowAbstention: true,
};

/**
 * Validate voting rules configuration.
 *
 * @param rules - The voting rules to validate
 * @returns null if rules are valid, or an error message string describing the validation failure
 *
 * @example
 * ```typescript
 * const error = validateVotingRules(myRules);
 * if (error) {
 *   console.error(`Invalid rules: ${error}`);
 * }
 * ```
 */
export function validateVotingRules(rules: VotingRules): string | null {
  if (rules.minimumParticipation < 0 || rules.minimumParticipation > 1) {
    return 'minimumParticipation must be between 0 and 1';
  }
  return null;
}
