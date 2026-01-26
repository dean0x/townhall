/**
 * Unit tests for EvaluationId module
 * Tests ID generation, validation, and utility functions
 */

import { describe, it, expect } from 'vitest';
import { EvaluationIdGenerator, EvaluationId } from '../../../../../src/simulations/decision/value-objects/EvaluationId';
import { ICryptoService } from '../../../../../src/core/services/ICryptoService';

// Mock crypto service for testing
const createMockCryptoService = (hashValue: string): ICryptoService => ({
  randomBytes: (_size: number) => new Uint8Array(32),
  hash: (_data: string, _algorithm: 'sha256' | 'sha512') => hashValue,
});

describe('EvaluationIdGenerator', () => {
  const validHash = 'c'.repeat(64);
  const anotherValidHash = 'd'.repeat(64);
  const invalidHashTooShort = 'c'.repeat(63);
  const invalidHashTooLong = 'c'.repeat(65);
  const invalidHashBadChars = 'x'.repeat(64);

  describe('fromContent', () => {
    it('should generate EvaluationId from content using crypto service', () => {
      const mockCrypto = createMockCryptoService(validHash);
      const id = EvaluationIdGenerator.fromContent('evaluation content', mockCrypto);
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

      EvaluationIdGenerator.fromContent('test', mockCrypto);
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

      EvaluationIdGenerator.fromContent('my evaluation content', mockCrypto);
      expect(calledWithData).toBe('my evaluation content');
    });
  });

  describe('fromHash', () => {
    it('should return Ok for valid SHA-256 hash', () => {
      const result = EvaluationIdGenerator.fromHash(validHash);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(validHash);
      }
    });

    it('should return Ok for lowercase hex hash', () => {
      const result = EvaluationIdGenerator.fromHash(validHash.toLowerCase());
      expect(result.isOk()).toBe(true);
    });

    it('should return Ok for uppercase hex hash', () => {
      const result = EvaluationIdGenerator.fromHash(validHash.toUpperCase());
      expect(result.isOk()).toBe(true);
    });

    it('should return Err for hash that is too short', () => {
      const result = EvaluationIdGenerator.fromHash(invalidHashTooShort);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid SHA-256 hash format for EvaluationId');
      }
    });

    it('should return Err for hash that is too long', () => {
      const result = EvaluationIdGenerator.fromHash(invalidHashTooLong);
      expect(result.isErr()).toBe(true);
    });

    it('should return Err for hash with invalid characters', () => {
      const result = EvaluationIdGenerator.fromHash(invalidHashBadChars);
      expect(result.isErr()).toBe(true);
    });

    it('should return Err for empty string', () => {
      const result = EvaluationIdGenerator.fromHash('');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('getShortHash', () => {
    it('should return first 7 characters by default', () => {
      const id = validHash as EvaluationId;
      const short = EvaluationIdGenerator.getShortHash(id);
      expect(short).toBe(validHash.slice(0, 7));
      expect(short.length).toBe(7);
    });

    it('should return specified number of characters', () => {
      const id = validHash as EvaluationId;
      expect(EvaluationIdGenerator.getShortHash(id, 5)).toBe(validHash.slice(0, 5));
      expect(EvaluationIdGenerator.getShortHash(id, 12)).toBe(validHash.slice(0, 12));
    });
  });

  describe('expandShortHash', () => {
    it('should return full ID when exactly one match exists', () => {
      const ids = [validHash, anotherValidHash] as EvaluationId[];
      const result = EvaluationIdGenerator.expandShortHash('ccc', ids);
      expect(result).toBe(validHash);
    });

    it('should return null when no matches exist', () => {
      const ids = [validHash, anotherValidHash] as EvaluationId[];
      const result = EvaluationIdGenerator.expandShortHash('fff', ids);
      expect(result).toBeNull();
    });

    it('should return null when multiple matches exist', () => {
      const ids = ['cde'.padEnd(64, '0'), 'cdf'.padEnd(64, '0')] as EvaluationId[];
      const result = EvaluationIdGenerator.expandShortHash('cd', ids);
      expect(result).toBeNull();
    });

    it('should return the ID when full hash is provided', () => {
      const ids = [validHash] as EvaluationId[];
      const result = EvaluationIdGenerator.expandShortHash(validHash, ids);
      expect(result).toBe(validHash);
    });

    it('should return null for empty availableIds array', () => {
      const result = EvaluationIdGenerator.expandShortHash('ccc', []);
      expect(result).toBeNull();
    });
  });
});
