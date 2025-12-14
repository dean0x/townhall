/**
 * ARCHITECTURE: Debate-specific value object
 * Pattern: String enum for type-safe status tracking
 * Rationale: Defines the lifecycle states of a debate simulation
 */

import { Result, ok, err } from '../../../shared/result';
import { ValidationError } from '../../../shared/errors';

export enum DebateStatus {
  ACTIVE = 'active',
  VOTING = 'voting',
  CLOSED = 'closed',
}

export const DEBATE_STATUSES: readonly DebateStatus[] = Object.values(DebateStatus);

export function isValidDebateStatus(value: string): value is DebateStatus {
  return DEBATE_STATUSES.includes(value as DebateStatus);
}

export function parseDebateStatus(value: string): Result<DebateStatus, ValidationError> {
  if (!isValidDebateStatus(value)) {
    return err(
      new ValidationError(
        `Invalid debate status: ${value}. Must be one of: ${DEBATE_STATUSES.join(', ')}`,
        'debateStatus'
      )
    );
  }
  return ok(value);
}

export function canTransitionTo(from: DebateStatus, to: DebateStatus): boolean {
  const validTransitions: Record<DebateStatus, DebateStatus[]> = {
    [DebateStatus.ACTIVE]: [DebateStatus.VOTING],
    [DebateStatus.VOTING]: [DebateStatus.CLOSED, DebateStatus.ACTIVE],
    [DebateStatus.CLOSED]: [], // No transitions from closed
  };

  return validTransitions[from]?.includes(to) ?? false;
}

export function getStatusDescription(status: DebateStatus): string {
  switch (status) {
    case DebateStatus.ACTIVE:
      return 'Debate is active and accepting arguments';
    case DebateStatus.VOTING:
      return 'Participants are voting to close the debate';
    case DebateStatus.CLOSED:
      return 'Debate has been closed by consensus';
  }
}
