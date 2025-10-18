# Data Model Specification

**Feature**: Townhall Phase 1 MVP - Debate Simulation Foundation
**Date**: 2025-01-26

## Core Entities

### 1. DebateSimulation
Represents an active debate context.

```typescript
interface DebateSimulation {
  readonly id: SimulationId;           // SHA-256 hash
  readonly topic: string;              // Debate topic/title
  readonly createdAt: Timestamp;        // ISO 8601
  readonly status: DebateStatus;       // 'active' | 'voting' | 'closed'
  readonly participantIds: readonly AgentId[];  // List of participating agents
  readonly argumentIds: readonly ArgumentId[];  // Ordered list of arguments
  readonly votesToClose: readonly CloseVote[];  // Consensus tracking
}
```

**Validation Rules**:
- Topic: 1-500 characters, required
- Status transitions: active → voting → closed (no backwards)
- ParticipantIds: Automatically added on first argument

### 2. Argument
Core entity representing an agent's contribution.

```typescript
interface Argument {
  readonly id: ArgumentId;             // SHA-256 of content
  readonly agentId: AgentId;           // Who made the argument
  readonly type: ArgumentType;         // 'deductive' | 'inductive' | 'empirical'
  readonly content: ArgumentContent;   // Type-specific structure
  readonly timestamp: Timestamp;       // When submitted
  readonly simulationId: SimulationId; // Which debate
  readonly metadata: ArgumentMetadata; // Additional context
}

interface ArgumentContent {
  // Polymorphic based on type
  readonly text: string;               // Human-readable form
  readonly structure: TypeSpecificStructure;
}

interface ArgumentMetadata {
  readonly hash: string;                // SHA-256 of content
  readonly shortHash: string;           // First 7 chars
  readonly sequenceNumber: number;      // Order in debate
}
```

**Validation Rules**:
- Content.text: 1-10000 characters
- Type-specific validation per ArgumentType
- Immutable after creation

### 3. Agent
Participant in debates (from MD files).

```typescript
interface Agent {
  readonly id: AgentId;                // UUID from frontmatter
  readonly name: string;               // Display name
  readonly type: AgentType;            // 'llm' | 'human' | 'hybrid'
  readonly capabilities: readonly string[];  // ['debate', 'analysis']
  readonly description: string;        // Markdown body
  readonly filePath: string;           // Source MD file location
}
```

**Validation Rules**:
- ID: Valid UUID v4
- Name: 1-100 characters
- Must exist as MD file with valid frontmatter

### 4. Rebuttal
Specialized argument that challenges another.

```typescript
interface Rebuttal extends Argument {
  readonly targetArgumentId: ArgumentId;  // What it rebuts
  readonly rebuttalType: RebuttalType;   // 'logical' | 'empirical' | 'methodological'
}
```

**Validation Rules**:
- TargetArgumentId must exist in same simulation
- Cannot rebut own arguments
- Must provide counter-reasoning

### 5. Concession
Acknowledgment of another's argument.

```typescript
interface Concession extends Argument {
  readonly targetArgumentId: ArgumentId;  // What is conceded to
  readonly concessionType: ConcessionType; // 'full' | 'partial' | 'conditional'
  readonly conditions?: string;          // If conditional
}
```

**Validation Rules**:
- TargetArgumentId must exist
- Cannot concede to own arguments
- Conditions required if type is 'conditional'

## Value Objects

### ArgumentId
```typescript
type ArgumentId = Brand<string, 'ArgumentId'>;  // SHA-256 hash
```

### AgentId
```typescript
type AgentId = Brand<string, 'AgentId'>;  // UUID v4
```

### SimulationId
```typescript
type SimulationId = Brand<string, 'SimulationId'>;  // SHA-256 hash
```

### Timestamp
```typescript
type Timestamp = Brand<string, 'Timestamp'>;  // ISO 8601
```

### ArgumentType
```typescript
type ArgumentType = 'deductive' | 'inductive' | 'empirical';
```

### DebateStatus
```typescript
type DebateStatus = 'active' | 'voting' | 'closed';
```

## Type-Specific Structures

### DeductiveStructure
```typescript
interface DeductiveStructure {
  readonly premises: readonly string[];  // Min 2 per literature
  readonly conclusion: string;
  readonly form?: DeductiveForm;  // 'modus_ponens' | 'syllogism' | etc
}
```

### InductiveStructure
```typescript
interface InductiveStructure {
  readonly observations: readonly string[];  // Min 2
  readonly generalization: string;
  readonly confidence?: number;  // 0-1 probability
}
```

### EmpiricalStructure
```typescript
interface EmpiricalStructure {
  readonly evidence: readonly Evidence[];
  readonly claim: string;
  readonly methodology?: string;
}

interface Evidence {
  readonly source: string;
  readonly citation?: string;
  readonly relevance: string;
}
```

## Relationships

### ArgumentRelationship
Tracks connections between arguments.

```typescript
interface ArgumentRelationship {
  readonly fromId: ArgumentId;
  readonly toId: ArgumentId;
  readonly type: RelationType;  // 'rebuts' | 'concedes_to' | 'supports'
  readonly strength?: number;   // 0-1 for analysis
}

type RelationType = 'rebuts' | 'concedes_to' | 'supports' | 'elaborates';
```

## State Transitions

### DebateSimulation States
```
created → active → voting → closed
         ↑________|
    (if no consensus)
```

### Argument States
Arguments are immutable once created (event-sourced).

## Storage Model

### Object Storage Structure
```
.townhall/
├── objects/
│   ├── arguments/
│   │   └── [sha256].json
│   ├── simulations/
│   │   └── [sha256].json
│   └── agents/
│       └── [uuid].json
├── refs/
│   ├── HEAD              # Current active simulation
│   └── simulations/
│       └── [name]        # Named simulation refs
└── index/
    ├── by-agent/
    ├── by-type/
    └── by-simulation/
```

## Validation Schemas (Zod)

```typescript
const ArgumentSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/),
  agentId: z.string().uuid(),
  type: z.enum(['deductive', 'inductive', 'empirical']),
  content: z.object({
    text: z.string().min(1).max(10000),
    structure: z.union([
      DeductiveStructureSchema,
      InductiveStructureSchema,
      EmpiricalStructureSchema
    ])
  }),
  timestamp: z.string().datetime(),
  simulationId: z.string().regex(/^[a-f0-9]{64}$/),
  metadata: ArgumentMetadataSchema
});
```

## Query Patterns

### Common Queries
1. **Get debate history**: All arguments in chronological order
2. **Get argument chain**: Follow rebuttal/concession relationships
3. **Get agent arguments**: All arguments by specific agent
4. **Get argument by hash**: Retrieve by full or short hash
5. **Get active debate**: Current simulation context

### Index Requirements
- Primary: Argument ID (hash)
- Secondary: Simulation ID, Agent ID, Timestamp
- Relationship: From/To argument IDs

## Constraints

### Integrity Constraints
1. Arguments cannot be modified after creation
2. Only one debate can be active at a time
3. Agents must exist before making arguments
4. References must point to existing arguments
5. Circular references are prevented

### Business Rules
1. Minimum 2 premises for deductive arguments
2. Minimum 2 observations for inductive arguments
3. Consensus required from all participants to close
4. Arguments must belong to active debate
5. Short hashes must uniquely identify arguments