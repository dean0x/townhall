# ADR-001: Simulation Type Registration and Shared Utilities

**Status**: Accepted
**Date**: 2025-12-11
**Deciders**: Project maintainers
**Related Issues**: #16, #12, #13, #14, #15

## Context

Townhall needs to support multiple simulation types beyond the current debate implementation:

| Simulation Type | Purpose | Example Actions |
|-----------------|---------|-----------------|
| Debate | Structured argumentation | Argument, Rebuttal, Concession |
| Decision | Group decision-making | Proposal, Evaluation, Objection |
| Brainstorm | Idea generation | Idea, BuildOn, Categorize |
| Root Cause Analysis | Problem diagnosis | Hypothesis, Evidence, Disproof |

The key architectural question: **How should simulation types be registered, and what utilities should be shared between them?**

## Decision

### 1. Static Registry with Plugin-Ready Design

**Choice**: Option A (Static Registry) with design patterns that enable future Option C (Hybrid/Plugin)

New simulation types are added to the codebase and registered explicitly at compile-time:

```typescript
// src/core/simulation/SimulationTypeRegistry.ts
import { DebateConfig } from '../../simulations/debate';
import { DecisionConfig } from '../../simulations/decision'; // future

const registry = new SimulationTypeRegistry();
registry.register(DebateConfig);
// registry.register(DecisionConfig); // future
```

**Rationale**:
- Full TypeScript type safety at compile time
- No runtime plugin loading complexity
- Clear, explicit registration
- Can evolve to plugin system when external users need extensibility
- YAGNI: We don't have external users yet

### 2. Composition Over Inheritance for Shared Utilities

Simulation types **compose** generic utilities from `core/` rather than inheriting from base classes.

### 3. Shared Utilities Decision

| Utility | Shared? | Location | Rationale |
|---------|---------|----------|-----------|
| **Voting** | Yes | `core/voting/` | Mechanics identical across types; only ballot shape differs |
| **Relationships** | Yes | `core/relationships/` | Graph operations identical; only validation rules differ |
| **Phases/Rounds** | No | Per-simulation | Semantics vary too much; abstraction too thin |
| **Agent Roles** | No | Per-simulation | Some simulations need roles, others don't |

## Architecture

### Directory Structure

```
src/
├── core/
│   ├── simulation/              # Generic simulation interfaces
│   │   ├── ISimulation.ts
│   │   ├── IAction.ts
│   │   ├── ISimulationConfig.ts
│   │   └── SimulationTypeRegistry.ts
│   │
│   ├── voting/                  # SHARED: Generic voting mechanics
│   │   ├── IVotingMechanism.ts
│   │   ├── VoteCalculator.ts
│   │   ├── VotingRules.ts
│   │   └── VoteStatus.ts
│   │
│   ├── relationships/           # SHARED: Generic relationship graph
│   │   ├── IRelationship.ts
│   │   ├── RelationshipGraph.ts
│   │   └── IRelationshipValidator.ts
│   │
│   └── entities/
│       └── Agent.ts             # Agents are simulation-agnostic
│
├── simulations/                 # Self-contained simulation types
│   ├── debate/
│   │   ├── entities/
│   │   │   ├── Argument.ts
│   │   │   ├── Rebuttal.ts
│   │   │   └── Concession.ts
│   │   ├── DebateSimulation.ts
│   │   ├── DebateConfig.ts
│   │   ├── DebatePhase.ts
│   │   ├── CloseVote.ts
│   │   ├── DebateRelationshipValidator.ts
│   │   └── index.ts
│   │
│   └── decision/                # Future simulation type
│       ├── entities/
│       ├── DecisionSimulation.ts
│       └── ...
│
├── application/
│   └── handlers/                # Handlers can be simulation-specific
│
└── interfaces/
    └── cli/
        └── commands/
            ├── base/            # Shared commands (init, status, log)
            └── debate/          # Debate-specific commands
```

### Shared Voting Design

The voting mechanism is generic over ballot type:

```typescript
// core/voting/IVotingMechanism.ts
interface BaseBallot {
  readonly agentId: AgentId;
  readonly timestamp: Timestamp;
}

interface IVotingMechanism<TBallot extends BaseBallot> {
  recordVote(ballot: TBallot): Result<void, VotingError>;
  hasConsensus(rules: VotingRules): boolean;
  getVoteStatus(): VoteStatus;
  getPendingVoters(): AgentId[];
}

// simulations/debate/CloseVote.ts
interface CloseVote extends BaseBallot {
  readonly vote: boolean;
  readonly reason: string;
}

// simulations/decision/ApprovalVote.ts
interface ApprovalVote extends BaseBallot {
  readonly vote: boolean;
  readonly confidence: number;
}
```

### Shared Relationships Design

The relationship graph is generic; validation rules are simulation-specific:

```typescript
// core/relationships/IRelationship.ts
interface IRelationship<TType extends string = string> {
  readonly fromId: ActionId;
  readonly toIds: readonly ActionId[];  // Supports multiple targets
  readonly type: TType;
  readonly strength?: number;
}

// core/relationships/IRelationshipValidator.ts
interface IRelationshipValidator<TSource, TTarget> {
  validate(source: TSource, targets: TTarget[]): Result<void, ValidationError>;
}

// simulations/debate/DebateRelationshipValidator.ts
class DebateRelationshipValidator implements IRelationshipValidator<Rebuttal, Argument> {
  validate(rebuttal: Rebuttal, targets: Argument[]): Result<void, ValidationError> {
    // Debate-specific rules:
    // - Can't rebut own argument
    // - Must be in same simulation
  }
}
```

## Boundary Rules

### Rule 1: No Cross-Simulation Imports

Simulation types must not import from each other:

```typescript
// NEVER: debate/ importing from decision/
import { Proposal } from '../decision/entities/Proposal';

// OK: Both import from core/
import { IAction } from '../../core/simulation/IAction';
```

### Rule 2: Core Knows Nothing About Specific Simulations

```typescript
// NEVER: core/ importing from simulations/
import { Argument } from '../../simulations/debate/entities/Argument';

// OK: core/ defines interfaces that simulations implement
export interface IAction { ... }
```

### Rule 3: Registration is the Only Cross-Boundary Point

The `SimulationTypeRegistry` is the only place where simulation types are "known" together:

```typescript
// This is the ONLY file that imports multiple simulation configs
import { DebateConfig } from '../../simulations/debate';
import { DecisionConfig } from '../../simulations/decision';

registry.register(DebateConfig);
registry.register(DecisionConfig);
```

### Rule 4: Shared Utilities Use Interfaces

Shared code in `core/` works with interfaces, not concrete types:

```typescript
// core/voting/VoteCalculator.ts
class VoteCalculator {
  // Works with any ballot type via interface
  calculateStatus<T extends BaseBallot>(
    ballots: T[],
    rules: VotingRules
  ): VoteStatus { ... }
}
```

## Consequences

### Positive

1. **Type Safety**: Full compile-time type checking across all simulation types
2. **Clear Boundaries**: Easy to understand what code belongs where
3. **Testability**: Simulation types can be tested in isolation
4. **Reuse Without Coupling**: Voting and relationships shared without tight coupling
5. **Future-Proof**: Can add plugin system later without rewriting

### Negative

1. **Explicit Registration**: Must manually register each new simulation type
2. **Some Duplication**: Phase logic not shared (but this is intentional)
3. **Refactoring Required**: Current debate code needs restructuring

### Neutral

1. **Learning Curve**: Developers must understand composition pattern
2. **More Files**: Separation creates more, smaller files

## Alternatives Considered

### Option B: Plugin System (Runtime)

External packages register simulation types at runtime.

**Rejected because**: Adds complexity we don't need yet. No external users requiring extensibility.

### Option C: Hybrid (Static Core + Plugins)

Core types compiled in, custom types via plugins.

**Deferred to**: Future consideration when we have external users.

### Option D: Convention-Based (Directory Scanning)

Auto-discover simulation types from directory structure.

**Rejected because**: "Magic" behavior makes debugging harder; TypeScript inference challenges.

### Inheritance-Based Sharing

Base classes like `BaseSimulation` with template methods.

**Rejected because**: Creates tight coupling; harder to compose behaviors; violates project's preference for composition.

## Implementation Plan

### Phase 1: Extract Interfaces (Sprint 2, Issue #12)
1. Create `ISimulation<TConfig, TStatus>` interface
2. Create `IAction` interface
3. Create `SimulationTypeRegistry`
4. Refactor `DebateSimulation` to implement interfaces

### Phase 2: Extract Shared Utilities
1. Generalize `VoteCalculator` to work with any ballot type
2. Extract `RelationshipGraph` from `RelationshipBuilder`
3. Create validation interfaces

### Phase 3: Reorganize Directory Structure
1. Move debate code to `simulations/debate/`
2. Create `core/voting/` and `core/relationships/`
3. Update imports throughout codebase

### Phase 4: Implement Second Simulation Type
1. Create `simulations/decision/` following established pattern
2. Validate that shared utilities work correctly
3. Ensure no cross-simulation coupling

## References

- Issue #16: Design Decision discussion
- Issue #12: Extract generic Simulation base
- Issue #13: Create generic Action system
- `/docs/architecture.md`: Hexagonal architecture overview
- `/.docs/product/vision-overview.md`: Product roadmap with simulation types
