/**
 * ARCHITECTURE: Infrastructure layer hash resolution service
 * Pattern: Short hash to full hash resolution (Git-like)
 * Rationale: Enables user-friendly short references
 */

import { injectable, inject } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { NotFoundError, ConflictError } from '../../shared/errors';
import { ObjectStorage } from './ObjectStorage';
import { TOKENS } from '../../shared/container';

export interface IHashResolver {
  resolveShortHash(shortHash: string, type: string): Promise<Result<string, Error>>;
}

@injectable()
export class HashResolver implements IHashResolver {
  constructor(
    @inject(TOKENS.ObjectStorage) private readonly storage: ObjectStorage
  ) {}

  /**
   * Resolves a short hash to its full hash
   * @param shortHash The short hash (minimum 7 characters)
   * @param type The object type (e.g., 'arguments', 'simulations')
   * @returns The full hash if found uniquely
   */
  public async resolveShortHash(shortHash: string, type: string): Promise<Result<string, Error>> {
    // Validate minimum length
    if (shortHash.length < 7) {
      return err(new ConflictError(`Short hash must be at least 7 characters, got ${shortHash.length}`));
    }

    // List all objects of the given type
    const listResult = await this.storage.list(type);
    if (listResult.isErr()) {
      return listResult;
    }

    const hashes = listResult.value;

    // Find matching hashes
    const matches = hashes.filter(hash => hash.startsWith(shortHash));

    if (matches.length === 0) {
      return err(new NotFoundError(`${type} object`, shortHash));
    }

    if (matches.length > 1) {
      return err(new ConflictError(
        `Ambiguous short hash '${shortHash}' matches ${matches.length} objects: ${matches.slice(0, 3).join(', ')}...`
      ));
    }

    return ok(matches[0]);
  }

  /**
   * Validates if a string is a valid full hash
   */
  public isFullHash(hash: string): boolean {
    return /^[a-f0-9]{64}$/.test(hash);
  }

  /**
   * Validates if a string could be a short hash
   */
  public isShortHash(hash: string): boolean {
    return /^[a-f0-9]{7,63}$/.test(hash);
  }
}