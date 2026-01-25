/**
 * Unit tests for ObjectionId module
 * Tests ID generation, validation, and utility functions
 */

import { describe, it, expect } from 'vitest';
import { ObjectionIdGenerator, ObjectionId } from '../../../../../src/simulations/decision/value-objects/ObjectionId';
import { ICryptoService } from '../../../../../src/core/services/ICryptoService';

// Mock crypto service for testing
const createMockCryptoService = (hashValue: string): ICryptoService => ({
  randomBytes: (_size: number) => new Uint8Array(32),
  hash: (_data: string, _algorithm: 'sha256' | 'sha512') => hashValue,
});

describe('ObjectionIdGenerator', () => {
  const validHash = 'e'.repeat(64);
  const anotherValidHash = 'f'.repeat(64);
  const invalidHashTooShort = 'e'.repeat(63);
  const invalidHashTooLong = 'e'.repeat(65);
  const invalidHashBadChars = 'z'.repeat(64);

  describe('fromContent', () => {
    it('should generate ObjectionId from content using crypto service', () => {
      const mockCrypto = createMockCryptoService(validHash);
      const id = ObjectionIdGenerator.fromContent('objection content', mockCrypto);
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

      ObjectionIdGenerator.fromContent('test', mockCrypto);
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

      ObjectionIdGenerator.fromContent('my objection content', mockCrypto);
      expect(calledWithData).toBe('my objection content');
    });
  });

  describe('fromHash', () => {
    it('should return Ok for valid SHA-256 hash', () => {
      const result = ObjectionIdGenerator.fromHash(validHash);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(validHash);
      }
    });

    it('should return Ok for lowercase hex hash', () => {
      const result = ObjectionIdGenerator.fromHash(validHash.toLowerCase());
      expect(result.isOk()).toBe(true);
    });

    it('should return Ok for uppercase hex hash', () => {
      const result = ObjectionIdGenerator.fromHash(validHash.toUpperCase());
      expect(result.isOk()).toBe(true);
    });

    it('should return Err for hash that is too short', () => {
      const result = ObjectionIdGenerator.fromHash(invalidHashTooShort);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain('Invalid SHA-256 hash format for ObjectionId');
      }
    });

    it('should return Err for hash that is too long', () => {
      const result = ObjectionIdGenerator.fromHash(invalidHashTooLong);
      expect(result.isErr()).toBe(true);
    });

    it('should return Err for hash with invalid characters', () => {
      const result = ObjectionIdGenerator.fromHash(invalidHashBadChars);
      expect(result.isErr()).toBe(true);
    });

    it('should return Err for empty string', () => {
      const result = ObjectionIdGenerator.fromHash('');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('getShortHash', () => {
    it('should return first 7 characters by default', () => {
      const id = validHash as ObjectionId;
      const short = ObjectionIdGenerator.getShortHash(id);
      expect(short).toBe(validHash.slice(0, 7));
      expect(short.length).toBe(7);
    });

    it('should return specified number of characters', () => {
      const id = validHash as ObjectionId;
      expect(ObjectionIdGenerator.getShortHash(id, 4)).toBe(validHash.slice(0, 4));
      expect(ObjectionIdGenerator.getShortHash(id, 15)).toBe(validHash.slice(0, 15));
    });
  });

  describe('expandShortHash', () => {
    it('should return full ID when exactly one match exists', () => {
      const ids = [validHash, anotherValidHash] as ObjectionId[];
      const result = ObjectionIdGenerator.expandShortHash('eee', ids);
      expect(result).toBe(validHash);
    });

    it('should return null when no matches exist', () => {
      const ids = [validHash, anotherValidHash] as ObjectionId[];
      const result = ObjectionIdGenerator.expandShortHash('aaa', ids);
      expect(result).toBeNull();
    });

    it('should return null when multiple matches exist', () => {
      const ids = ['ef0'.padEnd(64, '0'), 'ef1'.padEnd(64, '0')] as ObjectionId[];
      const result = ObjectionIdGenerator.expandShortHash('ef', ids);
      expect(result).toBeNull();
    });

    it('should return the ID when full hash is provided', () => {
      const ids = [validHash] as ObjectionId[];
      const result = ObjectionIdGenerator.expandShortHash(validHash, ids);
      expect(result).toBe(validHash);
    });

    it('should return null for empty availableIds array', () => {
      const result = ObjectionIdGenerator.expandShortHash('eee', []);
      expect(result).toBeNull();
    });
  });
});
