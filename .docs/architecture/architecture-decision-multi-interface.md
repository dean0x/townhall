# Townhall Multi-Interface Architecture Decision

## Context
Townhall must support multiple interfaces from the beginning:
- CLI (command-line interface)
- MCP (Model Context Protocol for AI agents)
- REST API (web services)
- SDK (programmatic access)

## Decision: Hexagonal Architecture with CQRS

### Core Principles

1. **Business Logic Independence**
   - Core domain NEVER depends on infrastructure
   - All I/O operations behind interfaces
   - Pure functions wherever possible

2. **Result Types Everywhere**
   ```typescript
   type Result<T, E> = Ok<T> | Err<E>
   ```
   - NO exceptions in business logic
   - Explicit error handling
   - Composable error chains

3. **Dependency Injection**
   ```typescript
   // Bad: Direct dependency
   class ArgumentService {
     private storage = new FileStorage() // ❌
   }

   // Good: Injected dependency
   class ArgumentService {
     constructor(private storage: StoragePort) {} // ✅
   }
   ```

## Architecture Layers

### 1. Core Domain (`/src/core`)
Pure business logic, zero dependencies

```
/src/core/
├── entities/
│   ├── Argument.ts         # Pure domain entity
│   ├── Agent.ts            # Agent identity
│   ├── Simulation.ts       # Simulation state
│   └── Citation.ts         # Evidence reference
├── value-objects/
│   ├── ArgumentId.ts       # SHA-256 hash
│   ├── AgentId.ts          # Agent identifier
│   ├── ArgumentType.ts     # Deductive|Inductive|etc
│   └── Timestamp.ts        # Immutable time
├── repositories/           # Port interfaces only
│   ├── IArgumentRepository.ts
│   ├── ISimulationRepository.ts
│   └── IAgentRepository.ts
└── services/              # Domain services
    ├── ArgumentValidator.ts
    ├── RelationshipBuilder.ts
    └── VoteCalculator.ts
```

### 2. Application Layer (`/src/application`)
Use cases and orchestration

```
/src/application/
├── commands/              # Write operations
│   ├── CreateArgumentCommand.ts
│   ├── SubmitRebuttalCommand.ts
│   ├── CastVoteCommand.ts
│   └── CommandBus.ts
├── queries/               # Read operations
│   ├── GetArgumentQuery.ts
│   ├── GetSimulationStateQuery.ts
│   ├── GetArgumentChainQuery.ts
│   └── QueryBus.ts
├── handlers/
│   ├── CreateArgumentHandler.ts
│   └── GetArgumentHandler.ts
└── ports/                # Application ports
    ├── IEventBus.ts
    └── ILogger.ts
```

### 3. Infrastructure (`/src/infrastructure`)
External dependencies and implementations

```
/src/infrastructure/
├── storage/
│   ├── FileArgumentRepository.ts  # Implements IArgumentRepository
│   ├── ObjectStorage.ts          # Content-addressed storage
│   └── IndexManager.ts            # Query optimization
├── events/
│   ├── InMemoryEventBus.ts
│   └── EventStore.ts
└── logging/
    └── StructuredLogger.ts
```

### 4. Interfaces (`/src/interfaces`)
User-facing adapters

```
/src/interfaces/
├── cli/
│   ├── commands/
│   │   ├── ArgumentCommand.ts
│   │   └── SimulateCommand.ts
│   ├── TownhallCLI.ts
│   └── index.ts              # CLI entry point
├── api/
│   ├── routes/
│   │   ├── arguments.ts
│   │   └── simulations.ts
│   ├── middleware/
│   │   └── validation.ts
│   └── server.ts             # Express/Fastify server
├── mcp/
│   ├── tools/
│   │   ├── ArgumentTool.ts
│   │   └── SimulationTool.ts
│   └── MCPServer.ts          # MCP protocol handler
└── sdk/
    ├── TownhallClient.ts     # Public API
    ├── types.ts              # Exported types
    └── index.ts              # SDK entry point
```

## Shared Command/Query Pattern

All interfaces translate to the same commands/queries:

```typescript
// CLI usage
townhall argument --type deductive "Premise..."
// Translates to:
commandBus.execute(new CreateArgumentCommand({
  type: ArgumentType.Deductive,
  content: "Premise..."
}))

// API usage
POST /api/arguments
{ "type": "deductive", "content": "Premise..." }
// Same command execution

// SDK usage
client.createArgument({
  type: ArgumentType.Deductive,
  content: "Premise..."
})
// Same command execution

// MCP usage
<tool name="create_argument">
  <param name="type">deductive</param>
  <param name="content">Premise...</param>
</tool>
// Same command execution
```

## Critical Implementation Rules

### 1. Start with Core + Application
```typescript
// First: Define the pure use case
class CreateArgumentHandler {
  constructor(
    private repo: IArgumentRepository,
    private validator: ArgumentValidator
  ) {}

  async execute(cmd: CreateArgumentCommand): Promise<Result<ArgumentId, ValidationError>> {
    const validation = this.validator.validate(cmd)
    if (!validation.ok) return validation

    const argument = Argument.create(cmd)
    const saved = await this.repo.save(argument)
    return saved
  }
}
```

### 2. Infrastructure Adapts to Core
```typescript
// Infrastructure implements core interfaces
class FileArgumentRepository implements IArgumentRepository {
  async save(arg: Argument): Promise<Result<ArgumentId, StorageError>> {
    // Adapt domain object to file storage
    const path = this.buildPath(arg.id)
    const json = this.serialize(arg)
    // ...
  }
}
```

### 3. Interfaces are Thin Translators
```typescript
// CLI just translates and delegates
class ArgumentCommand extends Command {
  async action(options: any) {
    const command = this.buildCommand(options) // translate CLI -> Command
    const result = await this.commandBus.execute(command)
    this.displayResult(result) // translate Result -> CLI output
  }
}
```

## Migration Path

### Phase 1: Core Foundation (NOW)
1. Define all domain entities
2. Create command/query types
3. Implement in-memory repositories
4. Build CLI using commands

### Phase 2: Add Storage
1. Implement file-based repositories
2. Add content-addressing
3. Build indexes

### Phase 3: Add API
1. Create Express/Fastify server
2. Map routes to commands
3. Add OpenAPI spec

### Phase 4: Add MCP
1. Implement MCP protocol
2. Map tools to commands
3. Add agent-specific features

### Phase 5: Extract SDK
1. Export application layer
2. Create client wrapper
3. Publish as package

## Why This Prevents Refactoring

1. **Single Source of Truth**: Business logic in one place
2. **Interface Independence**: Can add/remove interfaces without touching core
3. **Testability**: Mock repositories, test pure logic
4. **Flexibility**: Can swap storage (file → database) without changing business logic
5. **Consistency**: All interfaces use same commands/queries

## Anti-Patterns to Avoid

❌ **CLI-specific logic in core**
```typescript
// Bad: Core knows about CLI
class Argument {
  toCliOutput(): string { } // ❌
}
```

❌ **Direct file access in use cases**
```typescript
// Bad: Use case knows about files
class CreateArgumentHandler {
  fs.writeFileSync('.townhall/...') // ❌
}
```

❌ **Business rules in interfaces**
```typescript
// Bad: Validation in CLI
class ArgumentCommand {
  if (content.length < 10) { } // ❌ Should be in domain
}
```

## Next Steps

1. Create TypeScript project with strict config
2. Define core domain entities
3. Implement command/query buses
4. Build first use case end-to-end
5. Add CLI as thin layer on top