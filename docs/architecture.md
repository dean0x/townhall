# Townhall Architecture Guide

## Overview

Townhall follows **Hexagonal Architecture** (Ports & Adapters) with **CQRS** (Command Query Responsibility Segregation) pattern. This ensures clean separation of concerns, testability, and maintainability.

## Architecture Principles

1. **Dependency Rule**: Dependencies point inward. Core has no dependencies.
2. **Immutability**: All entities are immutable with factory methods
3. **Result Types**: No exceptions in business logic, use Result<T,E>
4. **Content-Addressed**: Git-like storage with SHA-256 hashing
5. **Event-Driven**: Commands and queries through buses
6. **Dependency Injection**: IoC via TSyringe

## Layer Architecture

```
┌─────────────────────────────────────┐
│         Interfaces Layer            │
│  (CLI, API, MCP, SDK - Adapters)   │
├─────────────────────────────────────┤
│       Application Layer             │
│  (Use Cases, Handlers, Commands)   │
├─────────────────────────────────────┤
│          Core Layer                 │
│  (Entities, Value Objects, Ports)  │
├─────────────────────────────────────┤
│     Infrastructure Layer           │
│  (Storage, Events, External APIs)  │
└─────────────────────────────────────┘
```

### Dependency Flow

```
Interfaces → Application → Core → Nothing
    ↓           ↓
Infrastructure ←┘
```

## Core Layer

Pure business logic with zero external dependencies.

### Entities

Immutable domain objects representing business concepts:

```typescript
// src/core/entities/Argument.ts
export class Argument {
  private constructor(
    public readonly id: ArgumentId,
    public readonly agentId: AgentId,
    public readonly type: ArgumentType,
    public readonly content: ArgumentContent,
    public readonly timestamp: Timestamp,
    public readonly simulationId: SimulationId,
    public readonly metadata: ArgumentMetadata
  ) {
    Object.freeze(this);
  }

  public static create(params: CreateArgumentParams): Argument {
    // Factory method with validation
  }
}
```

### Value Objects

Immutable, self-validating values:

```typescript
// src/core/value-objects/ArgumentId.ts
export type ArgumentId = String & { readonly __brand: 'ArgumentId' };

export class ArgumentIdGenerator {
  static fromContent(content: string): ArgumentId {
    const hash = createHash('sha256')
      .update(content)
      .digest('hex');
    return hash as ArgumentId;
  }
}
```

### Repository Interfaces

Contracts for data access (implementations in Infrastructure):

```typescript
// src/core/repositories/IArgumentRepository.ts
export interface IArgumentRepository {
  save(argument: Argument): Promise<Result<ArgumentId, StorageError>>;
  findById(id: ArgumentId): Promise<Result<Argument, NotFoundError>>;
  findBySimulation(simulationId: SimulationId): Promise<Result<Argument[], StorageError>>;
}
```

### Domain Services

Business logic that doesn't fit in entities:

```typescript
// src/core/services/ArgumentValidator.ts
export class ArgumentValidator implements IArgumentValidator {
  validate(argument: Argument): Result<void, ValidationError> {
    // Validation logic
  }
}
```

## Application Layer

Orchestrates use cases by coordinating domain objects.

### Commands & Queries

DTOs for application operations:

```typescript
// src/application/commands/CreateArgumentCommand.ts
export interface CreateArgumentCommand {
  readonly agentId: AgentId;
  readonly type: ArgumentType;
  readonly content: ArgumentContent;
}
```

### Handlers

Process commands and queries:

```typescript
// src/application/handlers/CreateArgumentHandler.ts
@injectable()
export class CreateArgumentHandler implements ICommandHandler<CreateArgumentCommand, CreateArgumentResult> {
  constructor(
    @inject(TOKENS.ArgumentRepository) private argumentRepo: IArgumentRepository,
    @inject(TOKENS.ArgumentValidator) private validator: IArgumentValidator
  ) {}

  async handle(command: CreateArgumentCommand): Promise<Result<CreateArgumentResult, Error>> {
    // 1. Validate
    // 2. Create entity
    // 3. Persist
    // 4. Return result
  }
}
```

### Command/Query Bus

Mediator pattern for decoupling:

```typescript
// src/application/handlers/CommandBus.ts
export class CommandBus {
  private handlers = new Map<string, ICommandHandler<any, any>>();

  register(commandName: string, handler: ICommandHandler<any, any>): void {
    this.handlers.set(commandName, handler);
  }

  async execute<T, R>(command: T, commandName: string): Promise<Result<R, Error>> {
    const handler = this.handlers.get(commandName);
    return handler.handle(command);
  }
}
```

## Infrastructure Layer

Implements core interfaces with external concerns.

### Storage Implementation

Content-addressed file storage:

```typescript
// src/infrastructure/storage/ObjectStorage.ts
export class ObjectStorage {
  async store(type: string, data: any): Promise<Result<string, StorageError>> {
    const id = data.id || createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const path = join(this.basePath, 'objects', type, `${id}.json`);
    // Write to filesystem
  }
}
```

### Repository Implementations

```typescript
// src/infrastructure/storage/FileArgumentRepository.ts
@injectable()
export class FileArgumentRepository implements IArgumentRepository {
  constructor(
    @inject(TOKENS.ObjectStorage) private storage: ObjectStorage
  ) {}

  async save(argument: Argument): Promise<Result<ArgumentId, StorageError>> {
    return this.storage.store('arguments', this.serializeArgument(argument));
  }
}
```

### External Services

```typescript
// src/infrastructure/events/InMemoryEventBus.ts
export class InMemoryEventBus implements IEventBus {
  private subscribers = new Map<string, EventHandler[]>();

  publish(event: DomainEvent): void {
    // Notify subscribers
  }
}
```

## Interfaces Layer

Thin adapters translating external inputs to application commands.

### CLI Adapter

```typescript
// src/interfaces/cli/commands/ArgumentCommand.ts
export class ArgumentCommand {
  constructor(private commandBus: ICommandBus) {}

  async execute(options: ArgumentOptions): Promise<void> {
    // 1. Parse CLI options
    // 2. Create command
    const command: CreateArgumentCommand = {
      agentId: options.agent,
      type: options.type,
      content: this.buildContent(options)
    };

    // 3. Execute via command bus
    const result = await this.commandBus.execute(command, 'CreateArgumentCommand');

    // 4. Format output for CLI
    if (result.isOk()) {
      console.log('✓ Argument created:', result.value.argumentId);
    }
  }
}
```

### Dependency Injection Setup

```typescript
// src/interfaces/cli/container-config.ts
export function configureContainer(): typeof container {
  // Core services
  container.register(TOKENS.ArgumentValidator, { useClass: ArgumentValidator });

  // Infrastructure
  container.register(TOKENS.ObjectStorage, {
    useFactory: () => new ObjectStorage('.townhall')
  });
  container.register(TOKENS.ArgumentRepository, { useClass: FileArgumentRepository });

  // Application handlers
  container.register(TOKENS.CreateArgumentHandler, { useClass: CreateArgumentHandler });

  // Command bus with handler registration
  container.register(TOKENS.CommandBus, {
    useFactory: () => {
      const bus = new CommandBus();
      bus.register('CreateArgumentCommand', container.resolve(TOKENS.CreateArgumentHandler));
      return bus;
    }
  });
}
```

## Data Flow Examples

### Creating an Argument

```
CLI Input
    ↓
ArgumentCommand (Interface Layer)
    ↓
CreateArgumentCommand (Application Layer)
    ↓
CommandBus.execute()
    ↓
CreateArgumentHandler.handle()
    ↓
Argument.create() (Core Layer)
    ↓
ArgumentRepository.save()
    ↓
ObjectStorage.store() (Infrastructure Layer)
    ↓
Filesystem
```

### Querying Debate History

```
CLI Request
    ↓
LogCommand (Interface Layer)
    ↓
GetDebateHistoryQuery (Application Layer)
    ↓
QueryBus.execute()
    ↓
GetDebateHistoryHandler.handle()
    ↓
SimulationRepository.getActive() (Infrastructure)
    ↓
ArgumentRepository.findBySimulation()
    ↓
Format & Return
```

## Storage Structure

Git-inspired content-addressed storage:

```
.townhall/
├── objects/
│   ├── arguments/
│   │   └── <sha256>.json
│   ├── simulations/
│   │   └── <sha256>.json
│   └── agents/
│       └── <sha256>.json
├── refs/
│   └── HEAD              # Points to active simulation
├── index/
│   ├── by-agent/
│   ├── by-simulation/
│   └── by-type/
└── agents/
    └── *.md              # Agent definition files
```

### Content Addressing

Each object is stored by its content hash:

```typescript
const content = JSON.stringify(argumentData);
const hash = createHash('sha256').update(content).digest('hex');
const path = `objects/arguments/${hash}.json`;
```

## Error Handling

### Result Types

No exceptions in business logic:

```typescript
export type Result<T, E> = Ok<T, E> | Err<T, E>;

// Usage
async function findArgument(id: ArgumentId): Promise<Result<Argument, NotFoundError>> {
  const data = await storage.get(id);
  if (!data) {
    return err(new NotFoundError('Argument', id));
  }
  return ok(deserialize(data));
}
```

### Error Types

Standardized error hierarchy:

```typescript
export abstract class DomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`, 'NOT_FOUND');
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}
```

## Testing Strategy

### Test Pyramid

```
         E2E (10%)
        /        \
   Integration (20%)
   /              \
Unit Tests (70%)
```

### Unit Tests

Test pure domain logic:

```typescript
describe('Argument', () => {
  it('should create deductive argument with valid structure', () => {
    const argument = Argument.create({
      type: ArgumentType.DEDUCTIVE,
      content: { premises: [...], conclusion: '...' }
    });
    expect(argument).toBeDefined();
  });
});
```

### Integration Tests

Test repository implementations:

```typescript
describe('FileArgumentRepository', () => {
  it('should persist and retrieve argument', async () => {
    const repo = new FileArgumentRepository();
    const argument = createTestArgument();

    const saveResult = await repo.save(argument);
    expect(saveResult.isOk()).toBe(true);

    const findResult = await repo.findById(argument.id);
    expect(findResult.value).toEqual(argument);
  });
});
```

### Contract Tests

Ensure handlers meet interface contracts:

```typescript
describe('CreateArgumentHandler Contract', () => {
  it('should return expected result shape', async () => {
    const result = await handler.handle(command);
    expect(result.value).toMatchObject({
      argumentId: expect.any(String),
      shortHash: expect.any(String),
      sequenceNumber: expect.any(Number),
      timestamp: expect.any(String)
    });
  });
});
```

## Performance Considerations

### Optimization Points

1. **Content Addressing**: O(1) lookups by hash
2. **Indexes**: Pre-built for common queries
3. **Lazy Loading**: Load relationships on demand
4. **Caching**: In-memory cache for active debate

### Performance Targets

- Argument creation: <100ms
- Query response: <50ms
- Debate initialization: <200ms

## Security Considerations

### Input Validation

All boundaries validate with Zod:

```typescript
const ArgumentSchema = z.object({
  type: z.enum(['deductive', 'inductive', 'empirical']),
  content: z.object({
    premises: z.array(z.string()).min(2),
    conclusion: z.string()
  })
});
```

### Agent Isolation

Each agent has unique UUID preventing impersonation.

### Immutable Storage

Content-addressed storage ensures tamper-proof history.

## Future Extensions

### Planned Interfaces

- REST API (Phase 2)
- MCP Protocol (Phase 2)
- SDK Package (Phase 3)
- Web UI (Phase 4)

### Scalability Path

- Database backend option
- Distributed storage
- Multi-debate support
- Real-time subscriptions

## Development Guidelines

### Adding New Commands

1. Define command in `application/commands/`
2. Create handler in `application/handlers/`
3. Register in container configuration
4. Add CLI adapter in `interfaces/cli/commands/`
5. Write contract tests

### Adding New Entities

1. Define entity in `core/entities/`
2. Create value objects in `core/value-objects/`
3. Define repository interface in `core/repositories/`
4. Implement repository in `infrastructure/storage/`
5. Write unit tests

### Code Style

- Immutable by default
- Factory methods over constructors
- Result types over exceptions
- Dependency injection over direct instantiation
- Pure functions in core layer