/**
 * ARCHITECTURE: Infrastructure implementation of agent repository
 * Pattern: MD file-based agent management
 * Rationale: Simple file-based agent definitions for MVP
 */

import { injectable, inject } from 'tsyringe';
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { Result, ok, err } from '../../shared/result';
import { NotFoundError, StorageError, ValidationError } from '../../shared/errors';
import { IAgentRepository, AgentMetadata } from '../../core/repositories/IAgentRepository';
import { ILogger } from '../../application/ports/ILogger';
import { Agent } from '../../core/entities/Agent';
import { AgentId, AgentIdGenerator } from '../../core/value-objects/AgentId';
import { AgentFileParser } from './AgentFileParser';
import { TOKENS } from '../../shared/container';

@injectable()
export class FileAgentRepository implements IAgentRepository {
  private readonly basePath: string;
  private readonly agentsDir: string;
  private readonly parser: AgentFileParser;
  private readonly logger: ILogger;
  private agentCache: Map<string, Agent>;

  constructor(
    @inject(TOKENS.Logger) logger: ILogger,
    basePath: string = '.townhall'
  ) {
    this.basePath = basePath;
    this.agentsDir = join(basePath, 'agents');
    this.parser = new AgentFileParser();
    this.logger = logger.child({ component: 'FileAgentRepository' });
    this.agentCache = new Map();
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
    this.logger.debug('Loading agent from file', { filePath });

    const parseResult = await this.parser.parseFile(filePath);
    if (parseResult.isErr()) {
      this.logger.error('Failed to parse agent file', parseResult.error, { filePath });
      return parseResult;
    }

    const agentData = parseResult.value;
    const agent = this.parser.createAgent(agentData, filePath);

    // Cache the agent
    this.agentCache.set(agent.id, agent);
    this.logger.info('Agent loaded from file', { agentId: agent.id, name: agent.name, filePath });

    return ok(agent);
  }

  public async saveToFile(agent: Agent): Promise<Result<void, StorageError>> {
    const filePath = agent.filePath || join(this.agentsDir, `${agent.id}.md`);
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
      await fs.mkdir(this.agentsDir, { recursive: true });

      // Write file
      await fs.writeFile(filePath, content, 'utf8');

      // Update cache
      this.agentCache.set(agent.id, agent);
      this.logger.info('Agent saved to file', { agentId: agent.id, name: agent.name, filePath });

      return ok(undefined);
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to save agent file', err, {
        agentId: agent.id,
        filePath,
        errorCode: (error as any).code
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
    const metadata: AgentMetadata[] = agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      capabilities: agent.capabilities,
      filePath: agent.filePath,
    }));

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

  public async refresh(): Promise<Result<void, StorageError>> {
    this.logger.debug('Refreshing agent cache from filesystem', { agentsDir: this.agentsDir });

    try {
      // Ensure agents directory exists
      await fs.mkdir(this.agentsDir, { recursive: true });

      // List all MD files in agents directory
      const files = await fs.readdir(this.agentsDir);
      const mdFiles = files.filter(file => file.endsWith('.md'));
      this.logger.debug('Found agent files', { count: mdFiles.length, files: mdFiles });

      // Clear cache
      this.agentCache.clear();

      // Load each agent file
      let successCount = 0;
      let failCount = 0;
      for (const file of mdFiles) {
        const filePath = join(this.agentsDir, file);
        const loadResult = await this.loadFromFile(filePath);
        // Skip files that fail to parse
        if (loadResult.isOk()) {
          const agent = loadResult.value;
          this.agentCache.set(agent.id, agent);
          successCount++;
        } else {
          failCount++;
          this.logger.warn('Skipping invalid agent file', { file, error: loadResult.error.message });
        }
      }

      this.logger.info('Agent cache refreshed', {
        totalFiles: mdFiles.length,
        loaded: successCount,
        failed: failCount,
        cachedCount: this.agentCache.size
      });

      return ok(undefined);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // Directory doesn't exist yet, that's okay
        this.logger.debug('Agents directory does not exist yet', { agentsDir: this.agentsDir });
        return ok(undefined);
      }
      const err = error as Error;
      this.logger.error('Failed to refresh agents', err, {
        agentsDir: this.agentsDir,
        errorCode: (error as any).code
      });
      return err(new StorageError(
        `Failed to refresh agents: ${err.message}`,
        'read'
      ));
    }
  }
}