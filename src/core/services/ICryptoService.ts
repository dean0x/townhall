/**
 * ARCHITECTURE: Core domain service interface for cryptographic operations
 * Pattern: Domain service interface (implementation in Infrastructure layer)
 * Rationale: Core layer defines contracts, Infrastructure provides implementations
 */

/**
 * Cryptographic service interface for domain layer
 *
 * This interface abstracts cryptographic operations away from Node.js crypto module,
 * allowing Core layer to remain framework-agnostic and testable.
 *
 * Implementations:
 * - NodeCryptoService (Infrastructure): Production adapter using Node.js crypto
 * - MockCryptoService (Test Helpers): Test double for deterministic testing
 */
export interface ICryptoService {
  /**
   * Generate cryptographically secure random bytes
   * @param size Number of bytes to generate
   * @returns Uint8Array of random bytes
   */
  randomBytes(size: number): Uint8Array;

  /**
   * Hash data using specified algorithm
   * @param data String data to hash
   * @param algorithm Hash algorithm (sha256, sha512, etc.)
   * @returns Hex-encoded hash string
   */
  hash(data: string, algorithm: 'sha256' | 'sha512'): string;
}
