/**
 * Mock crypto service for deterministic testing
 * Provides predictable values for UUIDs and hashes
 */

import { ICryptoService } from '../../src/core/services/ICryptoService';
import { randomBytes, createHash } from 'crypto';

/**
 * Mock implementation of ICryptoService for tests
 *
 * Uses real Node.js crypto but can be extended for deterministic values
 */
export class MockCryptoService implements ICryptoService {
  /**
   * Generate cryptographically secure random bytes
   */
  public randomBytes(size: number): Uint8Array {
    return new Uint8Array(randomBytes(size));
  }

  /**
   * Hash data using specified algorithm
   */
  public hash(data: string, algorithm: 'sha256' | 'sha512'): string {
    return createHash(algorithm).update(data, 'utf8').digest('hex');
  }
}

/**
 * Deterministic crypto service for tests requiring fixed values
 */
export class DeterministicCryptoService implements ICryptoService {
  private counter = 0;

  /**
   * Generate deterministic "random" bytes based on counter
   */
  public randomBytes(size: number): Uint8Array {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      bytes[i] = (this.counter + i) % 256;
    }
    this.counter += size;
    return bytes;
  }

  /**
   * Hash data using real SHA-256 (deterministic)
   */
  public hash(data: string, algorithm: 'sha256' | 'sha512'): string {
    return createHash(algorithm).update(data, 'utf8').digest('hex');
  }

  /**
   * Reset counter for reproducible test sequences
   */
  public reset(): void {
    this.counter = 0;
  }
}
