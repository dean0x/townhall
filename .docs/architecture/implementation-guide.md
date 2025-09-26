# Townhall Implementation Guide

## Project Structure

```
/townhall/
├── src/
│   ├── core/              # Pure domain logic (zero dependencies)
│   ├── application/       # Use cases and orchestration
│   ├── infrastructure/    # External world (storage, events)
│   ├── interfaces/        # User-facing (CLI, API, MCP, SDK)
│   └── shared/           # Cross-cutting utilities
├── tests/
│   ├── unit/             # Pure logic tests
│   ├── integration/      # Repository tests
│   └── e2e/              # Full flow tests
├── package.json
├── tsconfig.json         # Strict TypeScript config
└── .townhall/           # Runtime data (not in repo)
```

## Core Domain Implementation

### 1. Base Result Type
```typescript
// src/shared/result.ts
export type Result<T, E> = Ok<T> | Err<E>

export class Ok<T> {
  constructor(public readonly value: T) {}
  readonly ok = true as const
  map<U>(fn: (value: T) => U): Result<U, never> {
    return new Ok(fn(this.value))
  }
}

export class Err<E> {
  constructor(public readonly error: E) {}
  readonly ok = false as const
  map<U>(_: (value: never) => U): Result<U, E> {
    return this as any
  }
}

export const ok = <T>(value: T): Ok<T> => new Ok(value)
export const err = <E>(error: E): Err<E> => new Err(error)
```

### 2. Domain Entity Example
```typescript
// src/core/entities/Argument.ts
import { ArgumentId } from '../value-objects/ArgumentId'
import { ArgumentType } from '../value-objects/ArgumentType'
import { AgentId } from '../value-objects/AgentId'
import { Timestamp } from '../value-objects/Timestamp'

export class Argument {
  private constructor(
    public readonly id: ArgumentId,
    public readonly agentId: AgentId,
    public readonly type: ArgumentType,
    public readonly content: string,
    public readonly premises: string[],
    public readonly conclusion: string,
    public readonly timestamp: Timestamp,
    public readonly respondsTo?: ArgumentId,
    public readonly citations: Citation[] = []
  ) {}

  static create(params: {
    agentId: AgentId
    type: ArgumentType
    content: string
    premises: string[]
    conclusion: string
    respondsTo?: ArgumentId
  }): Argument {
    const id = ArgumentId.fromContent(params.content)
    return new Argument(
      id,
      params.agentId,
      params.type,
      params.content,
      params.premises,
      params.conclusion,
      Timestamp.now(),
      params.respondsTo
    )
  }

  withCitation(citation: Citation): Argument {
    return new Argument(
      this.id,
      this.agentId,
      this.type,
      this.content,
      this.premises,
      this.conclusion,
      this.timestamp,
      this.respondsTo,
      [...this.citations, citation]
    )
  }
}
```

### 3. Repository Interface
```typescript
// src/core/repositories/IArgumentRepository.ts
import { Result } from '../../shared/result'
import { Argument } from '../entities/Argument'
import { ArgumentId } from '../value-objects/ArgumentId'

export interface IArgumentRepository {
  save(argument: Argument): Promise<Result<ArgumentId, StorageError>>
  findById(id: ArgumentId): Promise<Result<Argument, NotFoundError>>
  findBySimulation(simId: string): Promise<Result<Argument[], StorageError>>
  findResponses(id: ArgumentId): Promise<Result<Argument[], StorageError>>
}

export class StorageError {
  constructor(public readonly message: string) {}
}

export class NotFoundError {
  constructor(public readonly id: string) {}
}
```

## Application Layer Implementation

### 4. Command Definition
```typescript
// src/application/commands/CreateArgumentCommand.ts
import { ArgumentType } from '../../core/value-objects/ArgumentType'

export class CreateArgumentCommand {
  constructor(
    public readonly agentId: string,
    public readonly simulationId: string,
    public readonly type: ArgumentType,
    public readonly content: string,
    public readonly premises: string[],
    public readonly conclusion: string,
    public readonly respondsTo?: string
  ) {}
}
```

### 5. Command Handler
```typescript
// src/application/handlers/CreateArgumentHandler.ts
import { inject, injectable } from 'tsyringe'
import { Result, ok, err } from '../../shared/result'
import { IArgumentRepository } from '../../core/repositories/IArgumentRepository'
import { ArgumentValidator } from '../../core/services/ArgumentValidator'
import { Argument } from '../../core/entities/Argument'
import { CreateArgumentCommand } from '../commands/CreateArgumentCommand'
import { ArgumentId } from '../../core/value-objects/ArgumentId'
import { AgentId } from '../../core/value-objects/AgentId'
import { IEventBus } from '../ports/IEventBus'
import { ArgumentCreatedEvent } from '../events/ArgumentCreatedEvent'

@injectable()
export class CreateArgumentHandler {
  constructor(
    @inject('ArgumentRepository') private repo: IArgumentRepository,
    @inject('ArgumentValidator') private validator: ArgumentValidator,
    @inject('EventBus') private eventBus: IEventBus
  ) {}

  async execute(command: CreateArgumentCommand): Promise<Result<ArgumentId, ValidationError>> {
    // Validate
    const validation = this.validator.validate(command)
    if (!validation.ok) return validation

    // Create domain entity
    const argument = Argument.create({
      agentId: new AgentId(command.agentId),
      type: command.type,
      content: command.content,
      premises: command.premises,
      conclusion: command.conclusion,
      respondsTo: command.respondsTo ? new ArgumentId(command.respondsTo) : undefined
    })

    // Save
    const saved = await this.repo.save(argument)
    if (!saved.ok) return err(new ValidationError(saved.error.message))

    // Emit event
    await this.eventBus.publish(new ArgumentCreatedEvent(argument))

    return ok(argument.id)
  }
}

export class ValidationError {
  constructor(public readonly message: string) {}
}
```

### 6. Command Bus
```typescript
// src/application/commands/CommandBus.ts
import { container } from 'tsyringe'
import { Result } from '../../shared/result'

export class CommandBus {
  private handlers = new Map<string, any>()

  register<TCommand, TResult>(
    commandType: new (...args: any[]) => TCommand,
    handlerType: new (...args: any[]) => { execute(cmd: TCommand): Promise<Result<TResult, any>> }
  ) {
    this.handlers.set(commandType.name, handlerType)
  }

  async execute<TCommand, TResult>(command: TCommand): Promise<Result<TResult, any>> {
    const handlerType = this.handlers.get(command.constructor.name)
    if (!handlerType) {
      throw new Error(`No handler for ${command.constructor.name}`)
    }
    const handler = container.resolve(handlerType)
    return handler.execute(command)
  }
}
```

## Infrastructure Implementation

### 7. File-based Repository
```typescript
// src/infrastructure/storage/FileArgumentRepository.ts
import { injectable } from 'tsyringe'
import { promises as fs } from 'fs'
import path from 'path'
import { Result, ok, err } from '../../shared/result'
import { IArgumentRepository, StorageError, NotFoundError } from '../../core/repositories/IArgumentRepository'
import { Argument } from '../../core/entities/Argument'
import { ArgumentId } from '../../core/value-objects/ArgumentId'

@injectable()
export class FileArgumentRepository implements IArgumentRepository {
  private basePath = '.townhall/objects'

  async save(argument: Argument): Promise<Result<ArgumentId, StorageError>> {
    try {
      const objectPath = this.getObjectPath(argument.id)
      await fs.mkdir(path.dirname(objectPath), { recursive: true })

      const data = this.serialize(argument)
      await fs.writeFile(objectPath, data, 'utf8')

      await this.updateIndex(argument)

      return ok(argument.id)
    } catch (error) {
      return err(new StorageError(`Failed to save: ${error.message}`))
    }
  }

  async findById(id: ArgumentId): Promise<Result<Argument, NotFoundError>> {
    try {
      const objectPath = this.getObjectPath(id)
      const data = await fs.readFile(objectPath, 'utf8')
      const argument = this.deserialize(data)
      return ok(argument)
    } catch (error) {
      if (error.code === 'ENOENT') {
        return err(new NotFoundError(id.value))
      }
      return err(new NotFoundError(`Read failed: ${error.message}`))
    }
  }

  private getObjectPath(id: ArgumentId): string {
    const hash = id.value
    return path.join(this.basePath, hash.slice(0, 2), hash.slice(2))
  }

  private serialize(argument: Argument): string {
    return JSON.stringify({
      id: argument.id.value,
      agentId: argument.agentId.value,
      type: argument.type,
      content: argument.content,
      premises: argument.premises,
      conclusion: argument.conclusion,
      timestamp: argument.timestamp.value,
      respondsTo: argument.respondsTo?.value,
      citations: argument.citations
    }, null, 2)
  }

  private deserialize(data: string): Argument {
    const json = JSON.parse(data)
    // Reconstruct domain entity from JSON
    // ...
  }
}
```

## Interface Implementation

### 8. CLI Command
```typescript
// src/interfaces/cli/commands/ArgumentCommand.ts
import { Command } from 'commander'
import { container } from 'tsyringe'
import { CommandBus } from '../../../application/commands/CommandBus'
import { CreateArgumentCommand } from '../../../application/commands/CreateArgumentCommand'
import { ArgumentType } from '../../../core/value-objects/ArgumentType'

export function createArgumentCommand(): Command {
  const cmd = new Command('argument')
    .description('Submit an argument in the current simulation')
    .requiredOption('--type <type>', 'Argument type (deductive|inductive|empirical|analogical|ethical)')
    .requiredOption('--content <content>', 'Full argument text')
    .option('--responds-to <id>', 'ID of argument being responded to')
    .action(async (options) => {
      const commandBus = container.resolve(CommandBus)

      // Parse premises and conclusion from content
      const { premises, conclusion } = parseArgument(options.content)

      const command = new CreateArgumentCommand(
        getCurrentAgent(), // from context
        getCurrentSimulation(), // from context
        options.type as ArgumentType,
        options.content,
        premises,
        conclusion,
        options.respondsTo
      )

      const result = await commandBus.execute(command)

      if (result.ok) {
        console.log(`Argument created: ${result.value.value}`)
      } else {
        console.error(`Failed: ${result.error.message}`)
        process.exit(1)
      }
    })

  return cmd
}
```

### 9. REST API Route
```typescript
// src/interfaces/api/routes/arguments.ts
import { Router } from 'express'
import { container } from 'tsyringe'
import { CommandBus } from '../../../application/commands/CommandBus'
import { CreateArgumentCommand } from '../../../application/commands/CreateArgumentCommand'

export function createArgumentRoutes(): Router {
  const router = Router()
  const commandBus = container.resolve(CommandBus)

  router.post('/arguments', async (req, res) => {
    const command = new CreateArgumentCommand(
      req.body.agentId,
      req.body.simulationId,
      req.body.type,
      req.body.content,
      req.body.premises,
      req.body.conclusion,
      req.body.respondsTo
    )

    const result = await commandBus.execute(command)

    if (result.ok) {
      res.status(201).json({ id: result.value.value })
    } else {
      res.status(400).json({ error: result.error.message })
    }
  })

  return router
}
```

### 10. MCP Tool
```typescript
// src/interfaces/mcp/tools/ArgumentTool.ts
import { Tool } from '@modelcontextprotocol/server'
import { container } from 'tsyringe'
import { CommandBus } from '../../../application/commands/CommandBus'
import { CreateArgumentCommand } from '../../../application/commands/CreateArgumentCommand'

export class ArgumentTool implements Tool {
  name = 'create_argument'
  description = 'Submit an argument in a debate simulation'

  parameters = {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['deductive', 'inductive', 'empirical', 'analogical', 'ethical'] },
      content: { type: 'string' },
      respondsTo: { type: 'string' }
    },
    required: ['type', 'content']
  }

  async execute(params: any) {
    const commandBus = container.resolve(CommandBus)

    const { premises, conclusion } = this.parseArgument(params.content)

    const command = new CreateArgumentCommand(
      params.agentId,
      params.simulationId,
      params.type,
      params.content,
      premises,
      conclusion,
      params.respondsTo
    )

    const result = await commandBus.execute(command)

    if (result.ok) {
      return { success: true, id: result.value.value }
    } else {
      return { success: false, error: result.error.message }
    }
  }
}
```

## Dependency Injection Setup

```typescript
// src/bootstrap.ts
import 'reflect-metadata'
import { container } from 'tsyringe'
import { IArgumentRepository } from './core/repositories/IArgumentRepository'
import { FileArgumentRepository } from './infrastructure/storage/FileArgumentRepository'
import { ArgumentValidator } from './core/services/ArgumentValidator'
import { IEventBus } from './application/ports/IEventBus'
import { InMemoryEventBus } from './infrastructure/events/InMemoryEventBus'
import { CommandBus } from './application/commands/CommandBus'
import { CreateArgumentHandler } from './application/handlers/CreateArgumentHandler'
import { CreateArgumentCommand } from './application/commands/CreateArgumentCommand'

export function bootstrap() {
  // Register infrastructure
  container.register<IArgumentRepository>('ArgumentRepository', {
    useClass: FileArgumentRepository
  })
  container.register<IEventBus>('EventBus', {
    useClass: InMemoryEventBus
  })

  // Register domain services
  container.registerSingleton(ArgumentValidator)

  // Register command bus and handlers
  const commandBus = new CommandBus()
  commandBus.register(CreateArgumentCommand, CreateArgumentHandler)
  container.registerInstance(CommandBus, commandBus)
}
```

## Testing Strategy

### Unit Test Example
```typescript
// tests/unit/core/entities/Argument.test.ts
import { Argument } from '../../../src/core/entities/Argument'
import { AgentId } from '../../../src/core/value-objects/AgentId'
import { ArgumentType } from '../../../src/core/value-objects/ArgumentType'

describe('Argument', () => {
  it('creates argument with unique ID from content', () => {
    const arg1 = Argument.create({
      agentId: new AgentId('agent1'),
      type: ArgumentType.Deductive,
      content: 'Test content',
      premises: ['P1'],
      conclusion: 'C1'
    })

    const arg2 = Argument.create({
      agentId: new AgentId('agent1'),
      type: ArgumentType.Deductive,
      content: 'Test content', // Same content
      premises: ['P1'],
      conclusion: 'C1'
    })

    expect(arg1.id.value).toBe(arg2.id.value) // Same hash
  })
})
```

### Integration Test Example
```typescript
// tests/integration/CreateArgument.test.ts
import { bootstrap } from '../../src/bootstrap'
import { container } from 'tsyringe'
import { CommandBus } from '../../src/application/commands/CommandBus'
import { CreateArgumentCommand } from '../../src/application/commands/CreateArgumentCommand'

describe('Create Argument Flow', () => {
  beforeAll(() => {
    bootstrap()
  })

  it('creates and retrieves argument', async () => {
    const commandBus = container.resolve(CommandBus)

    const command = new CreateArgumentCommand(
      'agent1',
      'sim1',
      ArgumentType.Deductive,
      'Test content',
      ['P1'],
      'C1'
    )

    const result = await commandBus.execute(command)

    expect(result.ok).toBe(true)
    expect(result.value).toBeDefined()
  })
})
```

## Package.json Configuration

```json
{
  "name": "@townhall/core",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e",
    "cli": "tsx src/interfaces/cli/index.ts",
    "api": "tsx src/interfaces/api/server.ts",
    "mcp": "tsx src/interfaces/mcp/server.ts"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "express": "^4.18.0",
    "@modelcontextprotocol/server": "^0.1.0",
    "tsyringe": "^4.8.0",
    "reflect-metadata": "^0.1.13"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  }
}
```

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```