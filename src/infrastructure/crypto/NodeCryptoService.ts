/**
 * ARCHITECTURE: Infrastructure implementation of ICryptoService
 * Pattern: Adapter for Node.js crypto module
 * Rationale: Isolates Node.js dependencies from Core layer
 */

import { injectable } from 'tsyringe';
import { randomBytes, createHash } from 'crypto';
import { ICryptoService } from '../../core/services/ICryptoService';

/**
 * Production implementation of ICryptoService using Node.js crypto
 *
 * This adapter wraps Node.js crypto functions to provide cryptographic
 * operations to the Core layer without creating a direct dependency.
 */
@injectable()
export class NodeCryptoService implements ICryptoService {
  /**
   * Generate cryptographically secure random bytes using Node.js crypto
   */
  public randomBytes(size: number): Uint8Array {
    return new Uint8Array(randomBytes(size));
  }

  /**
   * Hash data using Node.js crypto module
   */
  public hash(data: string, algorithm: 'sha256' | 'sha512'): string {
    return createHash(algorithm).update(data, 'utf8').digest('hex');
  }
}
