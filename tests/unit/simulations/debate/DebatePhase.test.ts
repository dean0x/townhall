/**
 * Unit tests for DebatePhase module
 * Tests phase enumeration, type guards, and phase utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  DebatePhase,
  isDebatePhase,
  getNextPhase,
  canSubmitArguments,
  canVote,
} from '../../../../src/simulations/debate/DebatePhase';

describe('DebatePhase', () => {
  describe('DebatePhase enum', () => {
    it('should have Opening phase', () => {
      expect(DebatePhase.Opening).toBe('opening');
    });

    it('should have Argumentation phase', () => {
      expect(DebatePhase.Argumentation).toBe('argumentation');
    });

    it('should have Voting phase', () => {
      expect(DebatePhase.Voting).toBe('voting');
    });

    it('should have Concluded phase', () => {
      expect(DebatePhase.Concluded).toBe('concluded');
    });

    it('should have exactly 4 phases', () => {
      expect(Object.values(DebatePhase)).toHaveLength(4);
    });
  });

  describe('isDebatePhase', () => {
    it('should return true for Opening', () => {
      expect(isDebatePhase('opening')).toBe(true);
      expect(isDebatePhase(DebatePhase.Opening)).toBe(true);
    });

    it('should return true for Argumentation', () => {
      expect(isDebatePhase('argumentation')).toBe(true);
      expect(isDebatePhase(DebatePhase.Argumentation)).toBe(true);
    });

    it('should return true for Voting', () => {
      expect(isDebatePhase('voting')).toBe(true);
      expect(isDebatePhase(DebatePhase.Voting)).toBe(true);
    });

    it('should return true for Concluded', () => {
      expect(isDebatePhase('concluded')).toBe(true);
      expect(isDebatePhase(DebatePhase.Concluded)).toBe(true);
    });

    it('should return false for invalid phase strings', () => {
      expect(isDebatePhase('invalid')).toBe(false);
      expect(isDebatePhase('OPENING')).toBe(false);
      expect(isDebatePhase('Opening')).toBe(false);
      expect(isDebatePhase('')).toBe(false);
    });

    it('should return false for non-strings', () => {
      expect(isDebatePhase(null)).toBe(false);
      expect(isDebatePhase(undefined)).toBe(false);
      expect(isDebatePhase(123)).toBe(false);
      expect(isDebatePhase({})).toBe(false);
      expect(isDebatePhase([])).toBe(false);
    });
  });

  describe('getNextPhase', () => {
    it('should return Argumentation after Opening', () => {
      expect(getNextPhase(DebatePhase.Opening)).toBe(DebatePhase.Argumentation);
    });

    it('should return Voting after Argumentation', () => {
      expect(getNextPhase(DebatePhase.Argumentation)).toBe(DebatePhase.Voting);
    });

    it('should return Concluded after Voting', () => {
      expect(getNextPhase(DebatePhase.Voting)).toBe(DebatePhase.Concluded);
    });

    it('should return undefined after Concluded', () => {
      expect(getNextPhase(DebatePhase.Concluded)).toBeUndefined();
    });

    it('should follow linear progression', () => {
      let phase: DebatePhase | undefined = DebatePhase.Opening;
      const progression: string[] = [phase];

      while (phase !== undefined) {
        phase = getNextPhase(phase);
        if (phase !== undefined) {
          progression.push(phase);
        }
      }

      expect(progression).toEqual([
        DebatePhase.Opening,
        DebatePhase.Argumentation,
        DebatePhase.Voting,
        DebatePhase.Concluded,
      ]);
    });
  });

  describe('canSubmitArguments', () => {
    it('should return true for Opening phase', () => {
      expect(canSubmitArguments(DebatePhase.Opening)).toBe(true);
    });

    it('should return true for Argumentation phase', () => {
      expect(canSubmitArguments(DebatePhase.Argumentation)).toBe(true);
    });

    it('should return false for Voting phase', () => {
      expect(canSubmitArguments(DebatePhase.Voting)).toBe(false);
    });

    it('should return false for Concluded phase', () => {
      expect(canSubmitArguments(DebatePhase.Concluded)).toBe(false);
    });
  });

  describe('canVote', () => {
    it('should return false for Opening phase', () => {
      expect(canVote(DebatePhase.Opening)).toBe(false);
    });

    it('should return false for Argumentation phase', () => {
      expect(canVote(DebatePhase.Argumentation)).toBe(false);
    });

    it('should return true for Voting phase', () => {
      expect(canVote(DebatePhase.Voting)).toBe(true);
    });

    it('should return false for Concluded phase', () => {
      expect(canVote(DebatePhase.Concluded)).toBe(false);
    });
  });

  describe('Phase behavior combinations', () => {
    it('should not allow both voting and argument submission in any phase', () => {
      for (const phase of Object.values(DebatePhase)) {
        const canDoArguments = canSubmitArguments(phase);
        const canDoVoting = canVote(phase);
        // Cannot both vote and submit arguments in the same phase
        expect(canDoArguments && canDoVoting).toBe(false);
      }
    });

    it('should have at least one action available in all phases except Concluded', () => {
      expect(canSubmitArguments(DebatePhase.Opening) || canVote(DebatePhase.Opening)).toBe(true);
      expect(canSubmitArguments(DebatePhase.Argumentation) || canVote(DebatePhase.Argumentation)).toBe(true);
      expect(canSubmitArguments(DebatePhase.Voting) || canVote(DebatePhase.Voting)).toBe(true);
      // Concluded allows no actions
      expect(canSubmitArguments(DebatePhase.Concluded) || canVote(DebatePhase.Concluded)).toBe(false);
    });
  });
});
