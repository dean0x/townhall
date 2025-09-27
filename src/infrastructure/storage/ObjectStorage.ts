/**
 * ARCHITECTURE: Infrastructure layer - content-addressed storage
 * Pattern: Git-like object storage with SHA-256 addressing
 * Rationale: Immutable, content-addressed storage for debate data
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
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
    this.basePath = basePath;
  }

  public async store(type: string, data: Record<string, unknown>): Promise<Result<string, StorageError>> {
    try {
      // Use the data's existing id if it has one, otherwise generate hash
      const id = (data.id as string) || createHash('sha256').update(JSON.stringify(data), 'utf8').digest('hex');

      const timestamp = new Date().toISOString();
      const obj: StorageObject = {
        id,
        type,
        data,
        timestamp,
      };

      // Ensure directory exists
      const objectDir = join(this.basePath, 'objects', type);
      await fs.mkdir(objectDir, { recursive: true });

      // Write file using the data's id
      const filePath = join(objectDir, `${id}.json`);
      const finalContent = JSON.stringify(obj, null, 2);
      await fs.writeFile(filePath, finalContent, 'utf8');

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
      const filePath = join(this.basePath, 'objects', type, `${id}.json`);
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
      const filePath = join(this.basePath, 'objects', type, `${id}.json`);
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
      const objectDir = join(this.basePath, 'objects', type);

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
      const filePath = join(this.basePath, 'objects', type, `${id}.json`);
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