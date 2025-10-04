/**
 * ARCHITECTURE: Infrastructure layer - content-addressed storage
 * Pattern: Git-like object storage with SHA-256 addressing
 * Rationale: Immutable, content-addressed storage for debate data
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join, dirname, resolve, relative } from 'path';
import { injectable } from 'tsyringe';
import { Result, ok, err } from '../../shared/result';
import { StorageError } from '../../shared/errors';

export interface StorageObject {
  readonly id: string;
  readonly type: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: string;
}

@injectable()
export class ObjectStorage {
  private readonly basePath: string;

  constructor(basePath: string = '.townhall') {
    this.basePath = resolve(basePath);
  }

  /**
   * Validates that a type parameter is safe (no path traversal)
   * SECURITY: Explicit empty string check + length validation for defense-in-depth
   */
  private validateType(type: string): Result<void, StorageError> {
    // Explicit checks for empty/whitespace strings
    if (!type || type.length === 0 || type.trim().length === 0) {
      return err(new StorageError('Invalid storage type: cannot be empty', 'validation'));
    }

    // Pattern validation (lowercase alphanumeric with hyphens)
    if (!/^[a-z0-9-]+$/.test(type)) {
      return err(new StorageError('Invalid storage type: must be lowercase alphanumeric with hyphens', 'validation'));
    }

    return ok(undefined);
  }

  /**
   * Validates that an ID parameter is safe (no path traversal)
   * SECURITY: Explicit empty string check + length validation for defense-in-depth
   */
  private validateId(id: string): Result<void, StorageError> {
    // Explicit checks for empty/whitespace strings
    if (!id || id.length === 0 || id.trim().length === 0) {
      return err(new StorageError('Invalid ID format: cannot be empty', 'validation'));
    }

    // Pattern validation (lowercase hexadecimal with hyphens)
    if (!/^[a-f0-9-]+$/.test(id)) {
      return err(new StorageError('Invalid ID format: must be lowercase hexadecimal with hyphens', 'validation'));
    }

    return ok(undefined);
  }

  /**
   * Ensures a resolved file path is within the base storage directory
   * SECURITY: Uses path.relative() to prevent case-insensitive filesystem bypasses
   */
  private validatePath(filePath: string): Result<void, StorageError> {
    const resolvedPath = resolve(filePath);
    const resolvedBase = resolve(this.basePath);

    // Use relative() to get the path from base to target
    // If the target is outside base, relative() will return a path starting with '..'
    const relativePath = relative(resolvedBase, resolvedPath);

    // Check if the relative path escapes the base directory
    // Note: Check for '../' or '..\' to ensure it's a path component, not just a filename starting with dots
    if (relativePath.startsWith('../') || relativePath.startsWith('..\\') || relativePath === '..' ||
        resolve(resolvedBase, relativePath) !== resolvedPath) {
      return err(new StorageError('Path traversal detected: attempted access outside storage directory', 'security'));
    }

    return ok(undefined);
  }

  public async store(type: string, data: Record<string, unknown>): Promise<Result<string, StorageError>> {
    try {
      // SECURITY: Validate type parameter to prevent path traversal
      const typeValidation = this.validateType(type);
      if (typeValidation.isErr()) {
        return err(typeValidation.error);
      }

      // SECURITY: If data.id is provided (even if empty), validate it first
      // Don't use falsy check || because empty string is falsy
      let id: string;
      if ('id' in data && data.id !== undefined && data.id !== null) {
        // ID was explicitly provided - validate it
        id = data.id as string;
        const idValidation = this.validateId(id);
        if (idValidation.isErr()) {
          return err(idValidation.error);
        }
      } else {
        // No ID provided - generate hash
        id = createHash('sha256').update(JSON.stringify(data), 'utf8').digest('hex');
      }

      const timestamp = new Date().toISOString();
      const obj: StorageObject = {
        id,
        type,
        data,
        timestamp,
      };

      // Ensure directory exists
      const objectDir = join(this.basePath, 'objects', type);
      await fs.mkdir(objectDir, { recursive: true, mode: 0o700 });

      // Write file using the data's id
      const filePath = join(objectDir, `${id}.json`);

      // SECURITY: Final path validation to ensure it's within basePath
      const pathValidation = this.validatePath(filePath);
      if (pathValidation.isErr()) {
        return err(pathValidation.error);
      }

      const finalContent = JSON.stringify(obj, null, 2);
      await fs.writeFile(filePath, finalContent, { encoding: 'utf8', mode: 0o600 });

      return ok(id);
    } catch (error) {
      return err(new StorageError(
        `Failed to store object: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'write'
      ));
    }
  }

  public async retrieve(type: string, id: string): Promise<Result<StorageObject, StorageError>> {
    try {
      // SECURITY: Validate parameters
      const typeValidation = this.validateType(type);
      if (typeValidation.isErr()) {
        return err(typeValidation.error);
      }

      const idValidation = this.validateId(id);
      if (idValidation.isErr()) {
        return err(idValidation.error);
      }

      const filePath = join(this.basePath, 'objects', type, `${id}.json`);

      // SECURITY: Validate path
      const pathValidation = this.validatePath(filePath);
      if (pathValidation.isErr()) {
        return err(pathValidation.error);
      }

      const content = await fs.readFile(filePath, 'utf8');
      const obj = JSON.parse(content) as StorageObject;

      return ok(obj);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return err(new StorageError(`Object not found: ${type}/${id}`, 'read'));
      }
      return err(new StorageError(
        `Failed to retrieve object: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'read'
      ));
    }
  }

  public async exists(type: string, id: string): Promise<Result<boolean, StorageError>> {
    try {
      // SECURITY: Validate parameters
      const typeValidation = this.validateType(type);
      if (typeValidation.isErr()) {
        return err(typeValidation.error);
      }

      const idValidation = this.validateId(id);
      if (idValidation.isErr()) {
        return err(idValidation.error);
      }

      const filePath = join(this.basePath, 'objects', type, `${id}.json`);

      // SECURITY: Validate path
      const pathValidation = this.validatePath(filePath);
      if (pathValidation.isErr()) {
        return err(pathValidation.error);
      }

      await fs.access(filePath);
      return ok(true);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return ok(false);
      }
      return err(new StorageError(
        `Failed to check existence: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'read'
      ));
    }
  }

  public async list(type: string): Promise<Result<string[], StorageError>> {
    try {
      // SECURITY: Validate type parameter
      const typeValidation = this.validateType(type);
      if (typeValidation.isErr()) {
        return err(typeValidation.error);
      }

      const objectDir = join(this.basePath, 'objects', type);

      // SECURITY: Validate path
      const pathValidation = this.validatePath(objectDir);
      if (pathValidation.isErr()) {
        return err(pathValidation.error);
      }

      try {
        const files = await fs.readdir(objectDir);
        const ids = files
          .filter(file => file.endsWith('.json'))
          .map(file => file.slice(0, -5)); // Remove .json extension

        return ok(ids);
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          return ok([]); // Directory doesn't exist, return empty list
        }
        throw error;
      }
    } catch (error) {
      return err(new StorageError(
        `Failed to list objects: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'read'
      ));
    }
  }

  public async delete(type: string, id: string): Promise<Result<void, StorageError>> {
    try {
      // SECURITY: Validate parameters
      const typeValidation = this.validateType(type);
      if (typeValidation.isErr()) {
        return err(typeValidation.error);
      }

      const idValidation = this.validateId(id);
      if (idValidation.isErr()) {
        return err(idValidation.error);
      }

      const filePath = join(this.basePath, 'objects', type, `${id}.json`);

      // SECURITY: Validate path
      const pathValidation = this.validatePath(filePath);
      if (pathValidation.isErr()) {
        return err(pathValidation.error);
      }

      await fs.unlink(filePath);
      return ok(undefined);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return ok(undefined); // Already deleted
      }
      return err(new StorageError(
        `Failed to delete object: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'delete'
      ));
    }
  }

  public async initialize(): Promise<Result<void, StorageError>> {
    try {
      // Create base directory structure
      const dirs = [
        this.basePath,
        join(this.basePath, 'objects'),
        join(this.basePath, 'objects', 'arguments'),
        join(this.basePath, 'objects', 'simulations'),
        join(this.basePath, 'objects', 'agents'),
        join(this.basePath, 'refs'),
        join(this.basePath, 'refs', 'simulations'),
        join(this.basePath, 'index'),
        join(this.basePath, 'index', 'by-agent'),
        join(this.basePath, 'index', 'by-type'),
        join(this.basePath, 'index', 'by-simulation'),
        join(this.basePath, 'agents'),
      ];

      for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
      }

      return ok(undefined);
    } catch (error) {
      return err(new StorageError(
        `Failed to initialize storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'write'
      ));
    }
  }
}