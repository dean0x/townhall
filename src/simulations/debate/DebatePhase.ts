/**
 * ARCHITECTURE: Debate-specific phase enumeration
 * Pattern: String enum for type-safe phase transitions
 * Rationale: Phases define the state machine for debate progression
 */

/**
 * Phases of a debate simulation.
 *
 * Debates progress through phases in order:
 * 1. Opening - Initial arguments are submitted
 * 2. Argumentation - Rebuttals and concessions are exchanged
 * 3. Voting - Participants vote to close the debate
 * 4. Concluded - Debate is complete, no more actions allowed
 *
 * @example
 * ```typescript
 * if (debate.phase === DebatePhase.Voting) {
 *   // Accept close votes
 * }
 * ```
 */
export enum DebatePhase {
  /** Initial phase for opening arguments */
  Opening = 'opening',

  /** Main phase for rebuttals and concessions */
  Argumentation = 'argumentation',

  /** Voting phase to close the debate */
  Voting = 'voting',

  /** Final phase after debate is closed */
  Concluded = 'concluded',
}

/**
 * Type guard to check if a string is a valid DebatePhase.
 */
export function isDebatePhase(value: unknown): value is DebatePhase {
  return (
    typeof value === 'string' &&
    Object.values(DebatePhase).includes(value as DebatePhase)
  );
}

/**
 * Get the next phase in the debate progression.
 * Returns undefined if already at Concluded phase.
 */
export function getNextPhase(current: DebatePhase): DebatePhase | undefined {
  switch (current) {
    case DebatePhase.Opening:
      return DebatePhase.Argumentation;
    case DebatePhase.Argumentation:
      return DebatePhase.Voting;
    case DebatePhase.Voting:
      return DebatePhase.Concluded;
    case DebatePhase.Concluded:
      return undefined;
    default: {
      // Exhaustive check
      const exhaustiveCheck: never = current;
      return exhaustiveCheck;
    }
  }
}

/**
 * Check if a phase allows new arguments/rebuttals.
 */
export function canSubmitArguments(phase: DebatePhase): boolean {
  return phase === DebatePhase.Opening || phase === DebatePhase.Argumentation;
}

/**
 * Check if a phase allows voting.
 */
export function canVote(phase: DebatePhase): boolean {
  return phase === DebatePhase.Voting;
}
