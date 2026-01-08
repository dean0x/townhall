/**
 * Unit tests for CloseVote module
 * Tests factory function and type guard
 */

import { describe, it, expect } from 'vitest';
import { createCloseVote, isCloseVote, CloseVote } from '../../../../src/simulations/debate/CloseVote';
import { AgentId } from '../../../../src/core/value-objects/AgentId';
import { Timestamp } from '../../../../src/core/value-objects/Timestamp';

describe('CloseVote', () => {
  const validAgentId = 'agent-123' as AgentId;
  const validTimestamp = '2025-01-26T10:00:00.000Z' as Timestamp;

  describe('createCloseVote', () => {
    it('should create a CloseVote with required fields', () => {
      const vote = createCloseVote({
        agentId: validAgentId,
        vote: true,
        timestamp: validTimestamp,
      });

      expect(vote.agentId).toBe(validAgentId);
      expect(vote.vote).toBe(true);
      expect(vote.timestamp).toBe(validTimestamp);
      expect(vote.reason).toBeUndefined();
    });

    it('should create a CloseVote with optional reason', () => {
      const reason = 'All major points have been addressed';
      const vote = createCloseVote({
        agentId: validAgentId,
        vote: true,
        timestamp: validTimestamp,
        reason,
      });

      expect(vote.reason).toBe(reason);
    });

    it('should create a CloseVote with vote=false', () => {
      const vote = createCloseVote({
        agentId: validAgentId,
        vote: false,
        timestamp: validTimestamp,
        reason: 'More discussion needed',
      });

      expect(vote.vote).toBe(false);
      expect(vote.reason).toBe('More discussion needed');
    });

    it('should return immutable object', () => {
      const vote = createCloseVote({
        agentId: validAgentId,
        vote: true,
        timestamp: validTimestamp,
      });

      expect(Object.isFrozen(vote)).toBe(true);
    });

    it('should not include reason property when undefined', () => {
      const vote = createCloseVote({
        agentId: validAgentId,
        vote: true,
        timestamp: validTimestamp,
        reason: undefined,
      });

      expect('reason' in vote).toBe(false);
    });
  });

  describe('isCloseVote', () => {
    it('should return true for valid CloseVote', () => {
      const vote = createCloseVote({
        agentId: validAgentId,
        vote: true,
        timestamp: validTimestamp,
      });

      expect(isCloseVote(vote)).toBe(true);
    });

    it('should return true for valid CloseVote with reason', () => {
      const vote = createCloseVote({
        agentId: validAgentId,
        vote: false,
        timestamp: validTimestamp,
        reason: 'Test reason',
      });

      expect(isCloseVote(vote)).toBe(true);
    });

    it('should return true for plain object matching CloseVote structure', () => {
      const vote = {
        agentId: 'some-agent',
        vote: true,
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(isCloseVote(vote)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isCloseVote(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isCloseVote(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isCloseVote('not an object')).toBe(false);
      expect(isCloseVote(123)).toBe(false);
      expect(isCloseVote(true)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isCloseVote({})).toBe(false);
    });

    it('should return false when agentId is missing', () => {
      const vote = {
        vote: true,
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(isCloseVote(vote)).toBe(false);
    });

    it('should return false when agentId is empty string', () => {
      const vote = {
        agentId: '',
        vote: true,
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(isCloseVote(vote)).toBe(false);
    });

    it('should return false when agentId is not a string', () => {
      const vote = {
        agentId: 123,
        vote: true,
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(isCloseVote(vote)).toBe(false);
    });

    it('should return false when vote is missing', () => {
      const vote = {
        agentId: 'agent-123',
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(isCloseVote(vote)).toBe(false);
    });

    it('should return false when vote is not a boolean', () => {
      const vote = {
        agentId: 'agent-123',
        vote: 'yes',
        timestamp: '2025-01-01T00:00:00.000Z',
      };

      expect(isCloseVote(vote)).toBe(false);
    });

    it('should return false when timestamp is missing', () => {
      const vote = {
        agentId: 'agent-123',
        vote: true,
      };

      expect(isCloseVote(vote)).toBe(false);
    });

    it('should return false when timestamp is empty string', () => {
      const vote = {
        agentId: 'agent-123',
        vote: true,
        timestamp: '',
      };

      expect(isCloseVote(vote)).toBe(false);
    });

    it('should return false when timestamp is not a string', () => {
      const vote = {
        agentId: 'agent-123',
        vote: true,
        timestamp: 12345,
      };

      expect(isCloseVote(vote)).toBe(false);
    });

    it('should return false when reason is not a string', () => {
      const vote = {
        agentId: 'agent-123',
        vote: true,
        timestamp: '2025-01-01T00:00:00.000Z',
        reason: 123,
      };

      expect(isCloseVote(vote)).toBe(false);
    });

    it('should return true when reason is empty string', () => {
      const vote = {
        agentId: 'agent-123',
        vote: true,
        timestamp: '2025-01-01T00:00:00.000Z',
        reason: '',
      };

      expect(isCloseVote(vote)).toBe(true);
    });
  });
});
