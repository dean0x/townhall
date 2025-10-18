
# Implementation Plan: Townhall Phase 1 MVP - Debate Simulation Foundation

**Branch**: `001-build-the-phase` | **Date**: 2025-01-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/workspace/chorus/specs/001-build-the-phase/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Building a Git-inspired CLI for structured agent debate simulations. The system enables agents to log structured arguments (deductive, inductive, empirical), track relationships between arguments, and query debate history. Following hexagonal architecture with content-addressed storage like Git, supporting one active debate at a time with agent identity via MD files.

## Technical Context
**Language/Version**: TypeScript 5.x (based on constitution's strict mode requirement)
**Primary Dependencies**: TSyringe (DI), Zod (validation), Commander (CLI), neverthrow (Result types)
**Storage**: File-based content-addressed storage (Git-like object model)
**Testing**: Vitest for unit/integration/E2E tests
**Target Platform**: Node.js 20+ (CLI application)
**Project Type**: single (CLI tool with potential for future API/MCP/SDK)
**Performance Goals**: Sub-100ms argument logging, instant query response (<50ms)
**Constraints**: Local-first, no network dependencies, immutable storage
**Scale/Scope**: MVP supports single debate, 100s of arguments per debate

**Note on Result Types**: Using `neverthrow` library for Result<T,E> implementation as per architecture docs,
avoiding custom implementation. All business logic returns Result types, no exceptions thrown.

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Core Principles Compliance
- [x] **Hexagonal Architecture**: Clear separation planned (core/application/infrastructure/interfaces)
- [x] **Result-Based Error Handling**: Using neverthrow for Result<T,E> types throughout
- [x] **Functional Core**: Domain entities immutable, pure business logic in core
- [x] **Test-Driven Development**: Contract tests first, then implementation
- [x] **Type Safety First**: TypeScript strict mode, Zod validation at boundaries
- [x] **Multi-Interface Ready**: Command/Query pattern from start (CLI now, API/MCP later)
- [x] **Immutability by Default**: Content-addressed storage, readonly types

### Architecture Standards
- [x] **Layer Dependencies**: Core → Nothing, proper dependency flow
- [x] **Dependency Injection**: TSyringe for DI container
- [x] **Content Addressing**: SHA-256 hashing for all arguments (Git-like)

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Following Hexagonal Architecture (as per .docs/architecture/)
src/
├── core/                    # Pure domain logic (zero dependencies)
│   ├── entities/           # Argument, Agent, Simulation, Rebuttal, Concession
│   │   ├── Argument.ts
│   │   ├── Agent.ts
│   │   ├── Simulation.ts
│   │   ├── Rebuttal.ts
│   │   └── Concession.ts
│   ├── value-objects/      # ArgumentId, AgentId, Timestamp, ArgumentType
│   │   ├── ArgumentId.ts
│   │   ├── AgentId.ts
│   │   ├── SimulationId.ts
│   │   ├── ArgumentType.ts
│   │   └── Timestamp.ts
│   ├── repositories/       # Interface definitions only
│   │   ├── IArgumentRepository.ts
│   │   ├── ISimulationRepository.ts
│   │   └── IAgentRepository.ts
│   └── services/          # Domain services
│       ├── ArgumentValidator.ts
│       ├── RelationshipBuilder.ts
│       └── VoteCalculator.ts
├── application/            # Use cases and orchestration
│   ├── commands/          # Write operations
│   │   ├── InitializeDebateCommand.ts
│   │   ├── CreateArgumentCommand.ts
│   │   ├── SubmitRebuttalCommand.ts
│   │   ├── SubmitConcessionCommand.ts
│   │   └── VoteToCloseCommand.ts
│   ├── queries/           # Read operations
│   │   ├── GetDebateHistoryQuery.ts
│   │   ├── GetArgumentQuery.ts
│   │   └── GetArgumentChainQuery.ts
│   ├── handlers/          # Command/Query handlers
│   │   ├── CommandBus.ts
│   │   ├── QueryBus.ts
│   │   └── [handlers for each command/query]
│   └── ports/             # Application-level interfaces
│       ├── IEventBus.ts
│       └── ILogger.ts
├── infrastructure/         # External world implementations
│   ├── storage/           # File-based implementations
│   │   ├── FileArgumentRepository.ts
│   │   ├── FileSimulationRepository.ts
│   │   ├── FileAgentRepository.ts
│   │   ├── ObjectStorage.ts      # Content-addressed storage
│   │   └── IndexManager.ts        # Query optimization
│   ├── events/            # Event handling
│   │   └── InMemoryEventBus.ts
│   └── logging/           # Logging implementation
│       └── StructuredLogger.ts
├── interfaces/            # User-facing adapters
│   └── cli/              # CLI implementation (Phase 1)
│       ├── commands/
│       │   ├── InitCommand.ts
│       │   ├── SimulateCommand.ts
│       │   ├── ArgumentCommand.ts
│       │   ├── RebuttalCommand.ts
│       │   ├── ConcessionCommand.ts
│       │   ├── LogCommand.ts
│       │   └── VoteCloseCommand.ts
│       ├── TownhallCLI.ts
│       └── index.ts      # CLI entry point
└── shared/               # Cross-cutting utilities
    ├── result.ts         # Result<T,E> type via neverthrow
    ├── types.ts          # Shared type definitions
    └── errors.ts         # Error type definitions

tests/
├── unit/                 # Pure logic tests
│   ├── core/            # Domain logic tests
│   └── application/     # Handler tests with mocked repos
├── integration/         # Repository and integration tests
│   └── infrastructure/ # Storage implementation tests
└── e2e/                 # End-to-end workflow tests
    └── cli/            # CLI command tests

.townhall/               # Runtime data (NOT in repository, created at runtime)
├── objects/            # Content-addressed storage
│   ├── arguments/      # Argument objects (SHA-256 named files)
│   ├── simulations/    # Simulation objects
│   └── agents/         # Agent data cache
├── refs/               # References to active objects
│   ├── HEAD           # Current active simulation reference
│   └── simulations/   # Named simulation references
├── index/             # Query optimization indexes
│   ├── by-agent/
│   ├── by-type/
│   └── by-simulation/
└── agents/            # Agent definition MD files
    └── *.md          # Agent files with YAML frontmatter
```

**Structure Decision**: Hexagonal Architecture - Aligned with .docs/architecture/ specifications

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Follow hexagonal architecture layer dependencies

**Task Categories (in TDD order)**:
1. **Core Domain** (zero dependencies)
   - Value objects creation [P]
   - Domain entities with factory methods [P]
   - Domain service interfaces [P]
   - Repository interfaces (ports) [P]

2. **Application Layer** (depends on Core)
   - Command/Query definitions [P]
   - Command/Query handlers
   - CommandBus/QueryBus setup
   - Application ports (IEventBus, ILogger)

3. **Infrastructure** (implements Core/Application interfaces)
   - Repository implementations
   - Storage layer (content-addressed)
   - Event bus implementation
   - Logger implementation

4. **Interface Layer** (CLI for Phase 1)
   - CLI command implementations
   - Command translation to application layer
   - Result display formatting

5. **Integration & E2E Tests**
   - Contract tests from OpenAPI spec
   - User story validation tests
   - Full workflow tests

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Core → Application → Infrastructure → Interfaces
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none needed)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
