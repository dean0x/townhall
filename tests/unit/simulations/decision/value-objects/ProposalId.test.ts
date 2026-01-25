/**
 * Unit tests for ProposalId module
 * Tests ID generation, validation, and utility functions
 */

import { describe, it, expect } from 'vitest';
import { ProposalIdGenerator, ProposalId } from '../../../../../src/simulations/decision/value-objects/ProposalId';
import { ICryptoService } from '../../../../../src/core/services/ICryptoService';

// Mock crypto service for testing
const createMockCryptoService = (hashValue: string): ICryptoService => ({
  randomBytes: (_size: number) => new Uint8Array(32),
  hash: (_data: string, _algorithm: 'sha256' | 'sha512') => hashValue,
});

describe('ProposalIdGenerator', () => {
  const validHash = 'a'.repeat(64);
  const anotherValidHash = 'b'.repeat(64);
  const invalidHashTooShort = 'a'.repeat(63);
  const invalidHashTooLong = 'a'.repeat(65);
  const invalidHashBadChars = 'g'.repeat(64);

  describe('fromContent', () => {
    it('should generate ProposalId from content using crypto service', () => {
      const mockCrypto = createMockCryptoService(validHash);
      const id = ProposalIdGenerator.fromContent('test content', mockCrypto);
      expect(id).toBe(validHash);
    });

    it('should use sha256 algorithm', () => {
      let calledWithAlgorithm: string | undefined;
      const mockCrypto: ICryptoService = {
        randomBytes: (_size: number) => new Uint8Array(32),
        hash: (_data: string, algorithm: 'sha256' | 'sha512') => {
          calledWithAlgorithm = algorithm;
          return validHash;
        },
      };

      ProposalIdGenerator.fromContent('test', mockCrypto);
      expect(calledWithAlgorithm).toBe('sha256');
    });

    it('should pass content to crypto service', () => {
      let calledWithData: string | undefined;
      const mockCrypto: ICryptoService = {
        randomBytes: (_size: number) => new Uint8Array(32),
        hash: (data: string, _algorithm: 'sha256' | 'sha512') => {
          calledWithData = data;
          return validHash;
        },
      };

      ProposalIdGenerator.fromContent('my proposal content', mockCrypto);
      expect(calledWithData).toBe('my proposal content');
    });
  });

  describe('fromHash', () => {
    it('should return Ok for valid SHA-256 hash', () => {
      const result = ProposalIdGenerator.fromHash(validHash);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(validHash);
      }
    });

    it('should return Ok for lowercase hex hash', () => {
      const result = ProposalIdGenerator.fromHash(validHash.toLowerCase());
      expect(result.isOk()).toBe(true);
    });

    it('should return Ok for uppercase hex hash', () => {
      const result = ProposalIdGenerator.fromHash(validHash.toUpperCase());
      expect(result.isOk()).toBe(true);
    });

    it('should return Ok for mixed case hex hash', () => {
      const mixedCase = 'aAbBcCdDeEfF'.repeat(5) + 'aaaa';
      const result = ProposalIdGenerator.fromHash(mixedCase);
      expect(result.isOk()).toBe(true);
    });

    it('should return Err for hash that is too short', () => {
      const result = ProposalIdGenerator.fromHash(invalidHashTooShort);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid SHA-256 hash format for ProposalId');
      }
    });

    it('should return Err for hash that is too long', () => {
      const result = ProposalIdGenerator.fromHash(invalidHashTooLong);
      expect(result.isErr()).toBe(true);
    });

    it('should return Err for hash with invalid characters', () => {
      const result = ProposalIdGenerator.fromHash(invalidHashBadChars);
      expect(result.isErr()).toBe(true);
    });

    it('should return Err for empty string', () => {
      const result = ProposalIdGenerator.fromHash('');
      expect(result.isErr()).toBe(true);
    });

    it('should return Err for non-hex characters', () => {
      const result = ProposalIdGenerator.fromHash('z'.repeat(64));
      expect(result.isErr()).toBe(true);
    });
  });

  describe('getShortHash', () => {
    it('should return first 7 characters by default', () => {
      const id = validHash as ProposalId;
      const short = ProposalIdGenerator.getShortHash(id);
      expect(short).toBe(validHash.slice(0, 7));
      expect(short.length).toBe(7);
    });

    it('should return specified number of characters', () => {
      const id = validHash as ProposalId;
      expect(ProposalIdGenerator.getShortHash(id, 3)).toBe(validHash.slice(0, 3));
      expect(ProposalIdGenerator.getShortHash(id, 10)).toBe(validHash.slice(0, 10));
      expect(ProposalIdGenerator.getShortHash(id, 64)).toBe(validHash);
    });

    it('should handle length of 1', () => {
      const id = validHash as ProposalId;
      expect(ProposalIdGenerator.getShortHash(id, 1)).toBe(validHash[0]);
    });
  });

  describe('expandShortHash', () => {
    it('should return full ID when exactly one match exists', () => {
      const ids = [validHash, anotherValidHash] as ProposalId[];
      const result = ProposalIdGenerator.expandShortHash('aaa', ids);
      expect(result).toBe(validHash);
    });

    it('should return null when no matches exist', () => {
      const ids = [validHash, anotherValidHash] as ProposalId[];
      const result = ProposalIdGenerator.expandShortHash('ccc', ids);
      expect(result).toBeNull();
    });

    it('should return null when multiple matches exist', () => {
      const ids = ['abc'.padEnd(64, '0'), 'abd'.padEnd(64, '0')] as ProposalId[];
      const result = ProposalIdGenerator.expandShortHash('ab', ids);
      expect(result).toBeNull();
    });

    it('should return the ID when full hash is provided', () => {
      const ids = [validHash] as ProposalId[];
      const result = ProposalIdGenerator.expandShortHash(validHash, ids);
      expect(result).toBe(validHash);
    });

    it('should return null for empty availableIds array', () => {
      const result = ProposalIdGenerator.expandShortHash('aaa', []);
      expect(result).toBeNull();
    });

    it('should be case-sensitive when matching', () => {
      // Test with mixed case ID to verify case sensitivity
      const mixedIds = ['abcdef'.padEnd(64, '0')] as ProposalId[];
      const upperResult = ProposalIdGenerator.expandShortHash('ABC', mixedIds);
      expect(upperResult).toBeNull(); // Should not match lowercase
    });
  });
});
