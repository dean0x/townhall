/**
 * ARCHITECTURE: Decision-specific value object
 * Pattern: String enum for type-safe status tracking
 * Rationale: Defines the lifecycle states of a decision simulation
 */

import { Result, ok, err } from '../../../shared/result';
import { ValidationError } from '../../../shared/errors';

/**
 * Decision simulation lifecycle states
 *
 * - GATHERING_PROPOSALS: Initial phase where agents submit proposals
 * - EVALUATING: Proposals are being evaluated and discussed
 * - VOTING: Agents are voting on proposals
 * - DECIDED: A decision has been reached
 * - ABANDONED: Decision process was abandoned without resolution
 */
export enum DecisionStatus {
  GATHERING_PROPOSALS = 'gathering_proposals',
  EVALUATING = 'evaluating',
  VOTING = 'voting',
  DECIDED = 'decided',
  ABANDONED = 'abandoned',
}

export const DECISION_STATUSES: readonly DecisionStatus[] = Object.values(DecisionStatus);

export function isValidDecisionStatus(value: string): value is DecisionStatus {
  return DECISION_STATUSES.includes(value as DecisionStatus);
}

export function parseDecisionStatus(value: string): Result<DecisionStatus, ValidationError> {
  if (!isValidDecisionStatus(value)) {
    return err(
      new ValidationError(
        `Invalid decision status: ${value}. Must be one of: ${DECISION_STATUSES.join(', ')}`,
        'decisionStatus'
      )
    );
  }
  return ok(value);
}

/**
 * Valid status transitions for decision simulation
 */
export function canTransitionTo(from: DecisionStatus, to: DecisionStatus): boolean {
  const validTransitions: Record<DecisionStatus, DecisionStatus[]> = {
    [DecisionStatus.GATHERING_PROPOSALS]: [DecisionStatus.EVALUATING, DecisionStatus.ABANDONED],
    [DecisionStatus.EVALUATING]: [DecisionStatus.VOTING, DecisionStatus.GATHERING_PROPOSALS, DecisionStatus.ABANDONED],
    [DecisionStatus.VOTING]: [DecisionStatus.DECIDED, DecisionStatus.EVALUATING, DecisionStatus.ABANDONED],
    [DecisionStatus.DECIDED]: [], // Terminal state - no transitions
    [DecisionStatus.ABANDONED]: [], // Terminal state - no transitions
  };

  return validTransitions[from]?.includes(to) ?? false;
}

export function getStatusDescription(status: DecisionStatus): string {
  switch (status) {
    case DecisionStatus.GATHERING_PROPOSALS:
      return 'Agents are submitting proposals for consideration';
    case DecisionStatus.EVALUATING:
      return 'Proposals are being evaluated and discussed';
    case DecisionStatus.VOTING:
      return 'Agents are voting on proposals';
    case DecisionStatus.DECIDED:
      return 'A decision has been reached';
    case DecisionStatus.ABANDONED:
      return 'Decision process was abandoned without resolution';
  }
}

/**
 * Check if a status is a terminal state (no further transitions possible)
 */
export function isTerminalStatus(status: DecisionStatus): boolean {
  return status === DecisionStatus.DECIDED || status === DecisionStatus.ABANDONED;
}
