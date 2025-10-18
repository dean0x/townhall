/**
 * ARCHITECTURE: Infrastructure layer tests
 * Pattern: Unit tests for NodeCryptoService cryptographic operations
 * Rationale: Ensure cryptographic operations work correctly and deterministically
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { NodeCryptoService } from '../../../../src/infrastructure/crypto/NodeCryptoService';

describe('NodeCryptoService', () => {
  let cryptoService: NodeCryptoService;

  beforeEach(() => {
    cryptoService = new NodeCryptoService();
  });

  describe('hash() - SHA-256', () => {
    it('should generate SHA-256 hash for simple string', () => {
      const input = 'hello world';
      const hash = cryptoService.hash(input, 'sha256');

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(64); // SHA-256 produces 64 hex characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // Hex string format
    });

    it('should produce deterministic hashes (same input = same output)', () => {
      const input = 'deterministic test';

      const hash1 = cryptoService.hash(input, 'sha256');
      const hash2 = cryptoService.hash(input, 'sha256');
      const hash3 = cryptoService.hash(input, 'sha256');

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = cryptoService.hash('input1', 'sha256');
      const hash2 = cryptoService.hash('input2', 'sha256');
      const hash3 = cryptoService.hash('input3', 'sha256');

      expect(hash1).not.toBe(hash2);
      expect(hash2).not.toBe(hash3);
      expect(hash1).not.toBe(hash3);
    });

    it('should produce different hashes for case-sensitive inputs', () => {
      const hash1 = cryptoService.hash('Hello', 'sha256');
      const hash2 = cryptoService.hash('hello', 'sha256');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = cryptoService.hash('', 'sha256');

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      // SHA-256 of empty string is known value
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('should handle large input strings', () => {
      const largeInput = 'a'.repeat(10000);
      const hash = cryptoService.hash(largeInput, 'sha256');

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle UTF-8 characters (emojis, special chars)', () => {
      const unicodeInput = 'Hello 世界 🌍 café';
      const hash = cryptoService.hash(unicodeInput, 'sha256');

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce known hash for test vector', () => {
      // Test vector from NIST
      const input = 'abc';
      const hash = cryptoService.hash(input, 'sha256');

      // Known SHA-256 hash of "abc"
      expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    it('should handle newlines and special characters', () => {
      const input = 'line1\nline2\ttabbed\rcarriage return';
      const hash1 = cryptoService.hash(input, 'sha256');
      const hash2 = cryptoService.hash(input, 'sha256');

      expect(hash1).toBe(hash2); // Deterministic
      expect(hash1).toHaveLength(64);
    });
  });

  describe('hash() - SHA-512', () => {
    it('should generate SHA-512 hash for simple string', () => {
      const input = 'hello world';
      const hash = cryptoService.hash(input, 'sha512');

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(128); // SHA-512 produces 128 hex characters
      expect(hash).toMatch(/^[a-f0-9]{128}$/);
    });

    it('should produce deterministic SHA-512 hashes', () => {
      const input = 'sha512 test';

      const hash1 = cryptoService.hash(input, 'sha512');
      const hash2 = cryptoService.hash(input, 'sha512');

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(128);
    });

    it('should produce different hashes than SHA-256 for same input', () => {
      const input = 'algorithm comparison';

      const sha256 = cryptoService.hash(input, 'sha256');
      const sha512 = cryptoService.hash(input, 'sha512');

      expect(sha256).not.toBe(sha512);
      expect(sha256).toHaveLength(64);
      expect(sha512).toHaveLength(128);
    });

    it('should handle empty string with SHA-512', () => {
      const hash = cryptoService.hash('', 'sha512');

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(128);
      expect(hash).toMatch(/^[a-f0-9]{128}$/);
      // SHA-512 of empty string is known value
      expect(hash).toBe(
        'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce' +
        '47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e'
      );
    });
  });

  describe('randomBytes()', () => {
    it('should generate random bytes of specified size', () => {
      const size = 32;
      const bytes = cryptoService.randomBytes(size);

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(size);
    });

    it('should generate different random bytes on each call', () => {
      const size = 16;

      const bytes1 = cryptoService.randomBytes(size);
      const bytes2 = cryptoService.randomBytes(size);
      const bytes3 = cryptoService.randomBytes(size);

      // All should be Uint8Array of correct size
      expect(bytes1).toBeInstanceOf(Uint8Array);
      expect(bytes2).toBeInstanceOf(Uint8Array);
      expect(bytes3).toBeInstanceOf(Uint8Array);

      // Should be different (extremely unlikely to be same for 16 random bytes)
      expect(Buffer.from(bytes1).toString('hex')).not.toBe(Buffer.from(bytes2).toString('hex'));
      expect(Buffer.from(bytes2).toString('hex')).not.toBe(Buffer.from(bytes3).toString('hex'));
      expect(Buffer.from(bytes1).toString('hex')).not.toBe(Buffer.from(bytes3).toString('hex'));
    });

    it('should handle generating 0 bytes', () => {
      const bytes = cryptoService.randomBytes(0);

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(0);
    });

    it('should handle generating 1 byte', () => {
      const bytes = cryptoService.randomBytes(1);

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(1);
      expect(bytes[0]).toBeGreaterThanOrEqual(0);
      expect(bytes[0]).toBeLessThanOrEqual(255);
    });

    it('should handle large byte arrays', () => {
      const size = 1024;
      const bytes = cryptoService.randomBytes(size);

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(size);
    });

    it('should generate bytes with values in valid range (0-255)', () => {
      const size = 100;
      const bytes = cryptoService.randomBytes(size);

      for (let i = 0; i < bytes.length; i++) {
        expect(bytes[i]).toBeGreaterThanOrEqual(0);
        expect(bytes[i]).toBeLessThanOrEqual(255);
      }
    });

    it('should generate reasonably distributed random values', () => {
      const size = 1000;
      const bytes = cryptoService.randomBytes(size);

      // Check that we have some variety in the bytes (not all zeros or all 255s)
      const uniqueValues = new Set(Array.from(bytes));

      // With 1000 random bytes, we should have many different values
      // (exact count varies, but should be much more than 10)
      expect(uniqueValues.size).toBeGreaterThan(50);
    });

    it('should work with different sizes consecutively', () => {
      const bytes8 = cryptoService.randomBytes(8);
      const bytes16 = cryptoService.randomBytes(16);
      const bytes32 = cryptoService.randomBytes(32);
      const bytes64 = cryptoService.randomBytes(64);

      expect(bytes8.length).toBe(8);
      expect(bytes16.length).toBe(16);
      expect(bytes32.length).toBe(32);
      expect(bytes64.length).toBe(64);
    });
  });

  describe('Integration - Hash of Random Bytes', () => {
    it('should be able to hash random bytes converted to string', () => {
      const bytes = cryptoService.randomBytes(32);
      const hexString = Buffer.from(bytes).toString('hex');

      const hash = cryptoService.hash(hexString, 'sha256');

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce consistent hashes for same random byte sequence', () => {
      const bytes = cryptoService.randomBytes(16);
      const hexString = Buffer.from(bytes).toString('hex');

      const hash1 = cryptoService.hash(hexString, 'sha256');
      const hash2 = cryptoService.hash(hexString, 'sha256');

      expect(hash1).toBe(hash2); // Same bytes should hash to same value
    });
  });
});
