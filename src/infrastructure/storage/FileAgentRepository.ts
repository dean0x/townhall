/**
 * ARCHITECTURE: Infrastructure implementation of agent repository
 * Pattern: MD file-based agent management
 * Rationale: Simple file-based agent definitions for MVP
 */

import { injectable, inject } from 'tsyringe';
import { promises as fs } from 'fs';
import { join, basename, resolve, relative } from 'path';
import { Result, ok, err } from '../../shared/result';
import { NotFoundError, StorageError, ValidationError } from '../../shared/errors';
import { IAgentRepository, AgentMetadata } from '../../core/repositories/IAgentRepository';
import { ILogger } from '../../application/ports/ILogger';
import { Agent } from '../../core/entities/Agent';
import { AgentId, AgentIdGenerator } from '../../core/value-objects/AgentId';
import { AgentFileParser } from './AgentFileParser';
import { TOKENS } from '../../shared/container';
import { hasErrorCode, isNodeSystemError } from './NodeSystemError';

@injectable()
export class FileAgentRepository implements IAgentRepository {
  private readonly basePath: string;
  private readonly agentsDir: string;
  private readonly parser: AgentFileParser;
  private readonly logger: ILogger;
  private agentCache: Map<string, Agent>;
  private fileTimestamps: Map<string, number>; // Track mtime for cache invalidation

  constructor(
    @inject(TOKENS.Logger) logger: ILogger,
    basePath: string = '.townhall'
  ) {
    this.basePath = resolve(basePath);
    this.agentsDir = join(this.basePath, 'agents');
    this.parser = new AgentFileParser();
    this.logger = logger.child({ component: 'FileAgentRepository' });
    this.agentCache = new Map();
    this.fileTimestamps = new Map();
  }

  /**
   * SECURITY: Validates that a file path is within the agents directory
   * Uses path.relative() to prevent case-insensitive filesystem bypasses
   */
  private async validateAgentPath(filePath: string): Promise<Result<void, StorageError>> {
    const resolvedPath = resolve(filePath);
    const resolvedAgentsDir = resolve(this.agentsDir);

    // Use relative() to get the path from agents dir to target
    // If the target is outside agents dir, relative() will return a path starting with '..'
    const relativePath = relative(resolvedAgentsDir, resolvedPath);

    // Check if the relative path escapes the agents directory
    // Note: Check for '../' or '..\' to ensure it's a path component, not just a filename starting with dots
    if (relativePath.startsWith('../') || relativePath.startsWith('..\\') || relativePath === '..' ||
        resolve(resolvedAgentsDir, relativePath) !== resolvedPath) {
      return err(new StorageError(
        'Path traversal detected: attempted access outside agents directory',
        'security'
      ));
    }

    try {
      const stats = await fs.lstat(resolvedPath);
      if (stats.isSymbolicLink()) {
        return err(new StorageError('Invalid file type', 'security'));
      }
    } catch (error) {
      if (!hasErrorCode(error, 'ENOENT')) {
        return err(new StorageError('File access error', 'read'));
      }
    }

    return ok(undefined);
  }

  public async findById(id: AgentId): Promise<Result<Agent, NotFoundError>> {
    this.logger.debug('Finding agent by ID', { agentId: id });

    // Check cache first
    const cached = this.agentCache.get(id);
    if (cached) {
      this.logger.debug('Agent found in cache', { agentId: id, name: cached.name });
      return ok(cached);
    }

    // Load all agents and find by ID
    this.logger.debug('Agent not in cache, refreshing from filesystem', { agentId: id });
    const refreshResult = await this.refresh();
    if (refreshResult.isErr()) {
      this.logger.error('Failed to refresh agents', refreshResult.error, { agentId: id });
      return err(new NotFoundError('Agent', id));
    }

    // Check cache again after refresh
    const agent = this.agentCache.get(id);
    if (!agent) {
      this.logger.warn('Agent not found after refresh', { agentId: id, cachedCount: this.agentCache.size });
      return err(new NotFoundError('Agent', id));
    }

    this.logger.info('Agent loaded successfully', { agentId: id, name: agent.name });
    return ok(agent);
  }

  public async loadFromFile(filePath: string): Promise<Result<Agent, ValidationError | StorageError>> {
    // SECURITY: Validate path is within agents directory
    const pathValidation = await this.validateAgentPath(filePath);
    if (pathValidation.isErr()) {
      this.logger.error('Path validation failed for loadFromFile', pathValidation.error, { filePath });
      return err(pathValidation.error);
    }

    this.logger.debug('Loading agent from file', { filePath });

    const parseResult = await this.parser.parseFile(filePath);
    if (parseResult.isErr()) {
      this.logger.error('Failed to parse agent file', parseResult.error, { filePath });
      return parseResult;
    }

    const agentData = parseResult.value;
    const agentResult = this.parser.createAgent(agentData, filePath);

    if (agentResult.isErr()) {
      this.logger.error('Failed to create agent from data', agentResult.error, { filePath });
      return err(agentResult.error);
    }

    const agent = agentResult.value;

    // Cache the agent
    this.agentCache.set(agent.id, agent);
    this.logger.info('Agent loaded from file', { agentId: agent.id, name: agent.name, filePath });

    return ok(agent);
  }

  public async saveToFile(agent: Agent): Promise<Result<void, StorageError>> {
    // SECURITY: Always construct path safely, ignore agent.filePath
    const safeFileName = `${agent.id}.md`.replace(/[^a-zA-Z0-9-_.]/g, '');
    const filePath = join(this.agentsDir, safeFileName);

    // SECURITY: Validate path is within agents directory
    const pathValidation = await this.validateAgentPath(filePath);
    if (pathValidation.isErr()) {
      this.logger.error('Path validation failed', pathValidation.error, { agentId: agent.id, filePath });
      return err(pathValidation.error);
    }

    this.logger.debug('Saving agent to file', { agentId: agent.id, name: agent.name, filePath });

    // Create YAML frontmatter
    const frontmatter = [
      '---',
      `id: ${agent.id}`,
      `name: ${agent.name}`,
      `type: ${agent.type}`,
      `capabilities: [${agent.capabilities.join(', ')}]`,
      '---',
      '',
    ].join('\n');

    // Add description as markdown
    const content = frontmatter + (agent.description || `# ${agent.name}\n\nAgent configuration`);

    try {
      // Ensure directory exists
      await fs.mkdir(this.agentsDir, { recursive: true, mode: 0o700 });

      // Write file with restrictive permissions
      await fs.writeFile(filePath, content, { encoding: 'utf8', mode: 0o600 });

      // Update cache
      this.agentCache.set(agent.id, agent);
      this.logger.info('Agent saved to file', { agentId: agent.id, name: agent.name, filePath });

      return ok(undefined);
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to save agent file', err, {
        agentId: agent.id,
        filePath,
        errorCode: isNodeSystemError(error) ? error.code : undefined
      });
      return err(new StorageError(
        `Failed to save agent file: ${err.message}`,
        'write'
      ));
    }
  }

  public async listAll(): Promise<Result<Agent[], StorageError>> {
    const refreshResult = await this.refresh();
    if (refreshResult.isErr()) {
      return ok([]); // Return empty list if can't load agents
    }

    return ok(Array.from(this.agentCache.values()));
  }

  public async getMetadata(): Promise<Result<AgentMetadata[], StorageError>> {
    const listResult = await this.listAll();
    if (listResult.isErr()) {
      return listResult;
    }

    const agents = listResult.value;
    const metadata: AgentMetadata[] = agents.map(agent => {
      const filePath = join(this.agentsDir, basename(agent.filePath));
      const mtime = this.fileTimestamps.get(filePath);
      return {
        id: agent.id,
        name: agent.name,
        filePath: agent.filePath,
        lastModified: mtime ? new Date(mtime) : new Date(),
      };
    });

    return ok(metadata);
  }

  public async exists(id: AgentId): Promise<Result<boolean, StorageError>> {
    const findResult = await this.findById(id);
    return ok(findResult.isOk());
  }

  public async validateFile(filePath: string): Promise<Result<void, ValidationError>> {
    const parseResult = await this.parser.parseFile(filePath);
    if (parseResult.isErr()) {
      return err(parseResult.error as ValidationError);
    }
    return ok(undefined);
  }

  /**
   * Refreshes the agent cache from filesystem
   * PERFORMANCE: Uses mtime-based cache invalidation to avoid re-parsing unchanged files
   */
  public async refresh(): Promise<Result<void, StorageError>> {
    this.logger.debug('Refreshing agent cache from filesystem', { agentsDir: this.agentsDir });

    try {
      // Ensure agents directory exists
      await fs.mkdir(this.agentsDir, { recursive: true });

      // List all MD files in agents directory
      const files = await fs.readdir(this.agentsDir);
      const mdFiles = files.filter(file => file.endsWith('.md'));
      this.logger.debug('Found agent files', { count: mdFiles.length, files: mdFiles });

      // Track which files still exist
      const currentFiles = new Set<string>();

      // Load each agent file (only if modified)
      let successCount = 0;
      let failCount = 0;
      let skippedCount = 0;
      for (const file of mdFiles) {
        const filePath = join(this.agentsDir, file);
        currentFiles.add(filePath);

        // Check file modification time
        const stats = await fs.stat(filePath);
        const currentMtime = stats.mtimeMs;
        const cachedMtime = this.fileTimestamps.get(filePath);

        // Skip if file hasn't been modified since last load
        if (cachedMtime !== undefined && cachedMtime === currentMtime) {
          this.logger.debug('Skipping unchanged file', { file, mtime: currentMtime });
          skippedCount++;
          continue;
        }

        // File is new or modified - load it
        const loadResult = await this.loadFromFile(filePath);
        if (loadResult.isOk()) {
          const agent = loadResult.value;
          this.agentCache.set(agent.id, agent);
          this.fileTimestamps.set(filePath, currentMtime);
          successCount++;
          this.logger.debug('Loaded agent file', {
            file,
            agentId: agent.id,
            mtime: currentMtime,
            wasModified: cachedMtime !== currentMtime
          });
        } else {
          failCount++;
          this.logger.warn('Skipping invalid agent file', { file, error: loadResult.error.message });
        }
      }

      // Remove deleted files from cache and timestamps
      const deletedFiles: string[] = [];
      for (const [filePath, agent] of Array.from(this.agentCache.entries()).map(([id, agent]) => {
        const fp = join(this.agentsDir, `${basename(agent.filePath)}`);
        return [fp, agent] as [string, Agent];
      })) {
        if (!currentFiles.has(filePath)) {
          const agentId = agent.id;
          this.agentCache.delete(agentId);
          this.fileTimestamps.delete(filePath);
          deletedFiles.push(filePath);
          this.logger.debug('Removed deleted agent from cache', { filePath, agentId });
        }
      }

      this.logger.info('Agent cache refreshed', {
        totalFiles: mdFiles.length,
        loaded: successCount,
        skipped: skippedCount,
        failed: failCount,
        deleted: deletedFiles.length,
        cachedCount: this.agentCache.size
      });

      return ok(undefined);
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        // Directory doesn't exist yet, that's okay
        this.logger.debug('Agents directory does not exist yet', { agentsDir: this.agentsDir });
        return ok(undefined);
      }
      const err = error as Error;
      this.logger.error('Failed to refresh agents', err, {
        agentsDir: this.agentsDir,
        errorCode: isNodeSystemError(error) ? error.code : undefined
      });
      return err(new StorageError(
        `Failed to refresh agents: ${err.message}`,
        'read'
      ));
    }
  }
}