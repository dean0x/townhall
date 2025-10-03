/**
 * ARCHITECTURE: Infrastructure implementation of agent repository
 * Pattern: MD file-based agent management
 * Rationale: Simple file-based agent definitions for MVP
 */

import { injectable } from 'tsyringe';
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { Result, ok, err } from '../../shared/result';
import { NotFoundError, StorageError, ValidationError } from '../../shared/errors';
import { IAgentRepository, AgentMetadata } from '../../core/repositories/IAgentRepository';
import { Agent } from '../../core/entities/Agent';
import { AgentId, AgentIdGenerator } from '../../core/value-objects/AgentId';
import { AgentFileParser } from './AgentFileParser';

@injectable()
export class FileAgentRepository implements IAgentRepository {
  private readonly basePath: string;
  private readonly agentsDir: string;
  private readonly parser: AgentFileParser;
  private agentCache: Map<string, Agent>;

  constructor(basePath: string = '.townhall') {
    this.basePath = basePath;
    this.agentsDir = join(basePath, 'agents');
    this.parser = new AgentFileParser();
    this.agentCache = new Map();
  }

  public async findById(id: AgentId): Promise<Result<Agent, NotFoundError>> {
    // Check cache first
    const cached = this.agentCache.get(id);
    if (cached) {
      return ok(cached);
    }

    // Load all agents and find by ID
    const refreshResult = await this.refresh();
    if (refreshResult.isErr()) {
      return err(new NotFoundError('Agent', id));
    }

    // Check cache again after refresh
    const agent = this.agentCache.get(id);
    if (!agent) {
      return err(new NotFoundError('Agent', id));
    }

    return ok(agent);
  }

  public async loadFromFile(filePath: string): Promise<Result<Agent, ValidationError | StorageError>> {
    const parseResult = await this.parser.parseFile(filePath);
    if (parseResult.isErr()) {
      return parseResult;
    }

    const agentData = parseResult.value;
    const agent = this.parser.createAgent(agentData, filePath);

    // Cache the agent
    this.agentCache.set(agent.id, agent);

    return ok(agent);
  }

  public async saveToFile(agent: Agent): Promise<Result<void, StorageError>> {
    const filePath = agent.filePath || join(this.agentsDir, `${agent.id}.md`);

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

      return ok(undefined);
    } catch (error) {
      return err(new StorageError(
        `Failed to save agent file: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    try {
      // Ensure agents directory exists
      await fs.mkdir(this.agentsDir, { recursive: true });

      // List all MD files in agents directory
      const files = await fs.readdir(this.agentsDir);
      const mdFiles = files.filter(file => file.endsWith('.md'));

      // Clear cache
      this.agentCache.clear();

      // Load each agent file
      for (const file of mdFiles) {
        const filePath = join(this.agentsDir, file);
        const loadResult = await this.loadFromFile(filePath);
        // Skip files that fail to parse
        if (loadResult.isOk()) {
          const agent = loadResult.value;
          this.agentCache.set(agent.id, agent);
        }
      }

      return ok(undefined);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // Directory doesn't exist yet, that's okay
        return ok(undefined);
      }
      return err(new StorageError(
        `Failed to refresh agents: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'read'
      ));
    }
  }
}