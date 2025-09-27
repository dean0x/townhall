/**
 * ARCHITECTURE: Infrastructure layer MD file parser
 * Pattern: Parser for agent definition files
 * Rationale: Extracts agent metadata from YAML frontmatter
 */

import { promises as fs } from 'fs';
import { Result, ok, err } from '../../shared/result';
import { ValidationError, StorageError } from '../../shared/errors';
import { Agent } from '../../core/entities/Agent';
import { AgentIdGenerator } from '../../core/value-objects/AgentId';

export interface AgentFileData {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly capabilities: string[];
  readonly description?: string;
  readonly model?: string;
  readonly instructions?: string;
}

export class AgentFileParser {
  /**
   * Parses an agent MD file with YAML frontmatter
   * Expected format:
   * ---
   * id: uuid
   * name: Agent Name
   * type: llm|human|hybrid
   * capabilities: [debate, analysis, reasoning]
   * model: gpt-4 (optional)
   * ---
   *
   * Agent description and instructions in markdown
   */
  public async parseFile(filePath: string): Promise<Result<AgentFileData, Error>> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return this.parseContent(content, filePath);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return err(new StorageError(`Agent file not found: ${filePath}`, 'read'));
      }
      return err(new StorageError(
        `Failed to read agent file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'read'
      ));
    }
  }

  public parseContent(content: string, filePath: string): Result<AgentFileData, Error> {
    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return err(new ValidationError('Agent file missing YAML frontmatter'));
    }

    const yamlContent = frontmatterMatch[1];
    const markdown = content.slice(frontmatterMatch[0].length).trim();

    // Parse YAML manually (simple parser for our needs)
    const data: Partial<AgentFileData> = {};
    const lines = yamlContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Handle key-value pairs
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      switch (key) {
        case 'id':
          data.id = this.parseString(value);
          break;
        case 'name':
          data.name = this.parseString(value);
          break;
        case 'type':
          data.type = this.parseString(value);
          break;
        case 'capabilities':
          data.capabilities = this.parseArray(value);
          break;
        case 'model':
          data.model = this.parseString(value);
          break;
      }
    }

    // Add markdown content as instructions/description
    if (markdown) {
      data.instructions = markdown;
      // Use first paragraph as description
      const firstParagraph = markdown.split('\n\n')[0];
      data.description = firstParagraph.replace(/^#+\s*/, '').trim();
    }

    // Validate required fields
    if (!data.id) {
      return err(new ValidationError('Agent file missing required field: id'));
    }
    if (!data.name) {
      return err(new ValidationError('Agent file missing required field: name'));
    }
    if (!data.type) {
      return err(new ValidationError('Agent file missing required field: type'));
    }
    if (!data.capabilities || data.capabilities.length === 0) {
      return err(new ValidationError('Agent file missing required field: capabilities'));
    }

    // Validate UUID format
    if (!this.isValidUUID(data.id)) {
      return err(new ValidationError(`Invalid UUID format in agent file: ${data.id}`));
    }

    // Validate agent type
    const validTypes = ['llm', 'human', 'hybrid'];
    if (!validTypes.includes(data.type)) {
      return err(new ValidationError(`Invalid agent type: ${data.type}. Must be one of: ${validTypes.join(', ')}`));
    }

    return ok(data as AgentFileData);
  }

  private parseString(value: string): string {
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    return value;
  }

  private parseArray(value: string): string[] {
    // Handle inline arrays [item1, item2]
    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value.slice(1, -1).split(',');
      return items.map(item => this.parseString(item.trim()));
    }
    // Single value
    if (value) {
      return [this.parseString(value)];
    }
    return [];
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Creates an Agent entity from parsed file data
   */
  public createAgent(data: AgentFileData, filePath: string): Agent {
    return Agent.create({
      id: AgentIdGenerator.fromString(data.id),
      name: data.name,
      type: data.type as 'llm' | 'human' | 'hybrid',
      capabilities: data.capabilities,
      description: data.description || '',
      filePath,
    });
  }
}