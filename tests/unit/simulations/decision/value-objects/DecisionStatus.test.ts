/**
 * Unit tests for DecisionStatus module
 * Tests status enumeration, type guards, transitions, and utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  DecisionStatus,
  DECISION_STATUSES,
  isValidDecisionStatus,
  parseDecisionStatus,
  canTransitionTo,
  getStatusDescription,
  isTerminalStatus,
} from '../../../../../src/simulations/decision/value-objects/DecisionStatus';

describe('DecisionStatus', () => {
  describe('DecisionStatus enum', () => {
    it('should have GATHERING_PROPOSALS status', () => {
      expect(DecisionStatus.GATHERING_PROPOSALS).toBe('gathering_proposals');
    });

    it('should have EVALUATING status', () => {
      expect(DecisionStatus.EVALUATING).toBe('evaluating');
    });

    it('should have VOTING status', () => {
      expect(DecisionStatus.VOTING).toBe('voting');
    });

    it('should have DECIDED status', () => {
      expect(DecisionStatus.DECIDED).toBe('decided');
    });

    it('should have ABANDONED status', () => {
      expect(DecisionStatus.ABANDONED).toBe('abandoned');
    });

    it('should have exactly 5 statuses', () => {
      expect(Object.values(DecisionStatus)).toHaveLength(5);
    });
  });

  describe('DECISION_STATUSES', () => {
    it('should be a readonly array of all statuses', () => {
      expect(DECISION_STATUSES).toContain(DecisionStatus.GATHERING_PROPOSALS);
      expect(DECISION_STATUSES).toContain(DecisionStatus.EVALUATING);
      expect(DECISION_STATUSES).toContain(DecisionStatus.VOTING);
      expect(DECISION_STATUSES).toContain(DecisionStatus.DECIDED);
      expect(DECISION_STATUSES).toContain(DecisionStatus.ABANDONED);
      expect(DECISION_STATUSES).toHaveLength(5);
    });
  });

  describe('isValidDecisionStatus', () => {
    it('should return true for all valid statuses', () => {
      expect(isValidDecisionStatus('gathering_proposals')).toBe(true);
      expect(isValidDecisionStatus('evaluating')).toBe(true);
      expect(isValidDecisionStatus('voting')).toBe(true);
      expect(isValidDecisionStatus('decided')).toBe(true);
      expect(isValidDecisionStatus('abandoned')).toBe(true);
    });

    it('should return true for enum values', () => {
      expect(isValidDecisionStatus(DecisionStatus.GATHERING_PROPOSALS)).toBe(true);
      expect(isValidDecisionStatus(DecisionStatus.EVALUATING)).toBe(true);
      expect(isValidDecisionStatus(DecisionStatus.VOTING)).toBe(true);
      expect(isValidDecisionStatus(DecisionStatus.DECIDED)).toBe(true);
      expect(isValidDecisionStatus(DecisionStatus.ABANDONED)).toBe(true);
    });

    it('should return false for invalid status strings', () => {
      expect(isValidDecisionStatus('invalid')).toBe(false);
      expect(isValidDecisionStatus('GATHERING_PROPOSALS')).toBe(false);
      expect(isValidDecisionStatus('Evaluating')).toBe(false);
      expect(isValidDecisionStatus('')).toBe(false);
      expect(isValidDecisionStatus('active')).toBe(false);
    });
  });

  describe('parseDecisionStatus', () => {
    it('should return Ok for valid statuses', () => {
      const result = parseDecisionStatus('gathering_proposals');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(DecisionStatus.GATHERING_PROPOSALS);
      }
    });

    it('should return Ok for all valid status strings', () => {
      for (const status of DECISION_STATUSES) {
        const result = parseDecisionStatus(status);
        expect(result.isOk()).toBe(true);
      }
    });

    it('should return Err for invalid status', () => {
      const result = parseDecisionStatus('invalid');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid decision status');
        expect(result.error.message).toContain('invalid');
        expect(result.error.field).toBe('decisionStatus');
      }
    });

    it('should return Err for empty string', () => {
      const result = parseDecisionStatus('');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('canTransitionTo', () => {
    describe('from GATHERING_PROPOSALS', () => {
      it('should allow transition to EVALUATING', () => {
        expect(canTransitionTo(DecisionStatus.GATHERING_PROPOSALS, DecisionStatus.EVALUATING)).toBe(true);
      });

      it('should allow transition to ABANDONED', () => {
        expect(canTransitionTo(DecisionStatus.GATHERING_PROPOSALS, DecisionStatus.ABANDONED)).toBe(true);
      });

      it('should not allow transition to VOTING', () => {
        expect(canTransitionTo(DecisionStatus.GATHERING_PROPOSALS, DecisionStatus.VOTING)).toBe(false);
      });

      it('should not allow transition to DECIDED', () => {
        expect(canTransitionTo(DecisionStatus.GATHERING_PROPOSALS, DecisionStatus.DECIDED)).toBe(false);
      });

      it('should not allow transition to self', () => {
        expect(canTransitionTo(DecisionStatus.GATHERING_PROPOSALS, DecisionStatus.GATHERING_PROPOSALS)).toBe(false);
      });
    });

    describe('from EVALUATING', () => {
      it('should allow transition to VOTING', () => {
        expect(canTransitionTo(DecisionStatus.EVALUATING, DecisionStatus.VOTING)).toBe(true);
      });

      it('should allow transition back to GATHERING_PROPOSALS', () => {
        expect(canTransitionTo(DecisionStatus.EVALUATING, DecisionStatus.GATHERING_PROPOSALS)).toBe(true);
      });

      it('should allow transition to ABANDONED', () => {
        expect(canTransitionTo(DecisionStatus.EVALUATING, DecisionStatus.ABANDONED)).toBe(true);
      });

      it('should not allow transition to DECIDED', () => {
        expect(canTransitionTo(DecisionStatus.EVALUATING, DecisionStatus.DECIDED)).toBe(false);
      });
    });

    describe('from VOTING', () => {
      it('should allow transition to DECIDED', () => {
        expect(canTransitionTo(DecisionStatus.VOTING, DecisionStatus.DECIDED)).toBe(true);
      });

      it('should allow transition back to EVALUATING', () => {
        expect(canTransitionTo(DecisionStatus.VOTING, DecisionStatus.EVALUATING)).toBe(true);
      });

      it('should allow transition to ABANDONED', () => {
        expect(canTransitionTo(DecisionStatus.VOTING, DecisionStatus.ABANDONED)).toBe(true);
      });

      it('should not allow transition to GATHERING_PROPOSALS', () => {
        expect(canTransitionTo(DecisionStatus.VOTING, DecisionStatus.GATHERING_PROPOSALS)).toBe(false);
      });
    });

    describe('from DECIDED (terminal state)', () => {
      it('should not allow any transitions', () => {
        expect(canTransitionTo(DecisionStatus.DECIDED, DecisionStatus.GATHERING_PROPOSALS)).toBe(false);
        expect(canTransitionTo(DecisionStatus.DECIDED, DecisionStatus.EVALUATING)).toBe(false);
        expect(canTransitionTo(DecisionStatus.DECIDED, DecisionStatus.VOTING)).toBe(false);
        expect(canTransitionTo(DecisionStatus.DECIDED, DecisionStatus.ABANDONED)).toBe(false);
        expect(canTransitionTo(DecisionStatus.DECIDED, DecisionStatus.DECIDED)).toBe(false);
      });
    });

    describe('from ABANDONED (terminal state)', () => {
      it('should not allow any transitions', () => {
        expect(canTransitionTo(DecisionStatus.ABANDONED, DecisionStatus.GATHERING_PROPOSALS)).toBe(false);
        expect(canTransitionTo(DecisionStatus.ABANDONED, DecisionStatus.EVALUATING)).toBe(false);
        expect(canTransitionTo(DecisionStatus.ABANDONED, DecisionStatus.VOTING)).toBe(false);
        expect(canTransitionTo(DecisionStatus.ABANDONED, DecisionStatus.DECIDED)).toBe(false);
        expect(canTransitionTo(DecisionStatus.ABANDONED, DecisionStatus.ABANDONED)).toBe(false);
      });
    });
  });

  describe('getStatusDescription', () => {
    it('should return description for GATHERING_PROPOSALS', () => {
      const desc = getStatusDescription(DecisionStatus.GATHERING_PROPOSALS);
      expect(desc).toBe('Agents are submitting proposals for consideration');
    });

    it('should return description for EVALUATING', () => {
      const desc = getStatusDescription(DecisionStatus.EVALUATING);
      expect(desc).toBe('Proposals are being evaluated and discussed');
    });

    it('should return description for VOTING', () => {
      const desc = getStatusDescription(DecisionStatus.VOTING);
      expect(desc).toBe('Agents are voting on proposals');
    });

    it('should return description for DECIDED', () => {
      const desc = getStatusDescription(DecisionStatus.DECIDED);
      expect(desc).toBe('A decision has been reached');
    });

    it('should return description for ABANDONED', () => {
      const desc = getStatusDescription(DecisionStatus.ABANDONED);
      expect(desc).toBe('Decision process was abandoned without resolution');
    });

    it('should return non-empty description for all statuses', () => {
      for (const status of DECISION_STATUSES) {
        const desc = getStatusDescription(status);
        expect(desc.length).toBeGreaterThan(0);
      }
    });
  });

  describe('isTerminalStatus', () => {
    it('should return true for DECIDED', () => {
      expect(isTerminalStatus(DecisionStatus.DECIDED)).toBe(true);
    });

    it('should return true for ABANDONED', () => {
      expect(isTerminalStatus(DecisionStatus.ABANDONED)).toBe(true);
    });

    it('should return false for GATHERING_PROPOSALS', () => {
      expect(isTerminalStatus(DecisionStatus.GATHERING_PROPOSALS)).toBe(false);
    });

    it('should return false for EVALUATING', () => {
      expect(isTerminalStatus(DecisionStatus.EVALUATING)).toBe(false);
    });

    it('should return false for VOTING', () => {
      expect(isTerminalStatus(DecisionStatus.VOTING)).toBe(false);
    });
  });
});
