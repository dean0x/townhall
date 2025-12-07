/**
 * Tests for shared types and validation functions
 * Including ReDoS protection tests
 */

import { describe, it, expect } from 'vitest';
import {
  isValidUUID,
  isValidSHA256,
  createUUID,
  createSHA256Hash,
  createNonEmptyString,
  createPositiveInteger,
} from '../../../src/shared/types';

describe('UUID Validation', () => {
  it('should accept valid UUIDs', () => {
    const validUUIDs = [
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      '550e8400-e29b-41d4-a716-446655440000',
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      '6BA7B810-9DAD-11D1-80B4-00C04FD430C8', // uppercase
    ];

    for (const uuid of validUUIDs) {
      expect(isValidUUID(uuid)).toBe(true);
    }
  });

  it('should reject invalid UUIDs', () => {
    const invalidUUIDs = [
      '',
      'not-a-uuid',
      'f47ac10b-58cc-4372-a567-0e02b2c3d47', // too short
      'f47ac10b-58cc-4372-a567-0e02b2c3d4799', // too long
      'f47ac10b-58cc-4372-a567-0e02b2c3d47g', // invalid character
      'f47ac10b58cc4372a5670e02b2c3d479', // missing dashes
    ];

    for (const uuid of invalidUUIDs) {
      expect(isValidUUID(uuid)).toBe(false);
    }
  });

  describe('ReDoS Protection', () => {
    it('should quickly reject oversized input without regex processing', () => {
      // This would cause catastrophic backtracking without length check
      const oversizedInput = 'a'.repeat(10000);

      const startTime = performance.now();
      const result = isValidUUID(oversizedInput);
      const duration = performance.now() - startTime;

      expect(result).toBe(false);
      // Should complete in under 10ms (instant rejection)
      expect(duration).toBeLessThan(10);
    });

    it('should quickly reject undersized input without regex processing', () => {
      const undersizedInput = 'abc';

      const startTime = performance.now();
      const result = isValidUUID(undersizedInput);
      const duration = performance.now() - startTime;

      expect(result).toBe(false);
      expect(duration).toBeLessThan(10);
    });

    it('should handle exactly wrong-length inputs correctly', () => {
      // 35 characters (one short)
      expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d47')).toBe(false);
      // 37 characters (one long)
      expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d4799')).toBe(false);
    });
  });
});

describe('SHA256 Validation', () => {
  it('should accept valid SHA256 hashes', () => {
    const validHashes = [
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD', // uppercase
    ];

    for (const hash of validHashes) {
      expect(isValidSHA256(hash)).toBe(true);
    }
  });

  it('should reject invalid SHA256 hashes', () => {
    const invalidHashes = [
      '',
      'not-a-hash',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85', // 63 chars
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b8555', // 65 chars
      'g3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // invalid char
    ];

    for (const hash of invalidHashes) {
      expect(isValidSHA256(hash)).toBe(false);
    }
  });

  describe('ReDoS Protection', () => {
    it('should quickly reject oversized input without regex processing', () => {
      const oversizedInput = 'a'.repeat(10000);

      const startTime = performance.now();
      const result = isValidSHA256(oversizedInput);
      const duration = performance.now() - startTime;

      expect(result).toBe(false);
      expect(duration).toBeLessThan(10);
    });

    it('should quickly reject undersized input without regex processing', () => {
      const undersizedInput = 'abc';

      const startTime = performance.now();
      const result = isValidSHA256(undersizedInput);
      const duration = performance.now() - startTime;

      expect(result).toBe(false);
      expect(duration).toBeLessThan(10);
    });

    it('should handle exactly wrong-length inputs correctly', () => {
      // 63 characters (one short)
      expect(isValidSHA256('a'.repeat(63))).toBe(false);
      // 65 characters (one long)
      expect(isValidSHA256('a'.repeat(65))).toBe(false);
    });
  });
});

describe('createUUID', () => {
  it('should create UUID from valid input', () => {
    const validUUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    expect(() => createUUID(validUUID)).not.toThrow();
  });

  it('should throw for invalid input', () => {
    expect(() => createUUID('invalid')).toThrow('Invalid UUID format');
  });
});

describe('createSHA256Hash', () => {
  it('should create SHA256 from valid input', () => {
    const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    expect(() => createSHA256Hash(validHash)).not.toThrow();
  });

  it('should throw for invalid input', () => {
    expect(() => createSHA256Hash('invalid')).toThrow('Invalid SHA256 hash format');
  });
});

describe('createNonEmptyString', () => {
  it('should create non-empty string from valid input', () => {
    expect(() => createNonEmptyString('hello')).not.toThrow();
    expect(() => createNonEmptyString(' ')).not.toThrow(); // whitespace is non-empty
  });

  it('should throw for empty string', () => {
    expect(() => createNonEmptyString('')).toThrow('String cannot be empty');
  });
});

describe('createPositiveInteger', () => {
  it('should create positive integer from valid input', () => {
    expect(() => createPositiveInteger(1)).not.toThrow();
    expect(() => createPositiveInteger(100)).not.toThrow();
  });

  it('should throw for invalid input', () => {
    expect(() => createPositiveInteger(0)).toThrow('Value must be a positive integer');
    expect(() => createPositiveInteger(-1)).toThrow('Value must be a positive integer');
    expect(() => createPositiveInteger(1.5)).toThrow('Value must be a positive integer');
  });
});
