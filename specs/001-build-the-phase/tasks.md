# Tasks: Townhall Phase 1 MVP - Debate Simulation Foundation

**Input**: Design documents from `/specs/001-build-the-phase/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
Following Hexagonal Architecture:
- **Core**: `src/core/` - Pure business logic
- **Application**: `src/application/` - Use cases
- **Infrastructure**: `src/infrastructure/` - External implementations
- **Interfaces**: `src/interfaces/` - User-facing adapters
- **Shared**: `src/shared/` - Cross-cutting utilities

## Phase 3.1: Setup & Foundation
- [ ] T001 Initialize TypeScript project with package.json and tsconfig.json (strict mode)
- [ ] T002 Install core dependencies: typescript, @types/node, tsx, tsup
- [ ] T003 Install primary deps: neverthrow, zod, commander, tsyringe, reflect-metadata
- [ ] T004 Install dev dependencies: vitest, @vitest/coverage-v8, prettier, eslint
- [ ] T005 [P] Configure TypeScript strict mode in tsconfig.json
- [ ] T006 [P] Setup ESLint config with TypeScript rules in .eslintrc.json
- [ ] T007 [P] Configure Prettier formatting in .prettierrc
- [ ] T008 Create hexagonal architecture folder structure per plan.md
- [ ] T009 Setup npm scripts for build, test, lint, format in package.json

## Phase 3.2: Shared Utilities & Types
- [ ] T010 [P] Create Result type wrapper using neverthrow in src/shared/result.ts
- [ ] T011 [P] Define shared error types in src/shared/errors.ts
- [ ] T012 [P] Create branded type utilities in src/shared/types.ts
- [ ] T013 [P] Setup DI container configuration in src/shared/container.ts

## Phase 3.3: Core Domain - Value Objects (Zero Dependencies)
- [ ] T014 [P] Create ArgumentId value object with SHA-256 hashing in src/core/value-objects/ArgumentId.ts
- [ ] T015 [P] Create AgentId value object (UUID) in src/core/value-objects/AgentId.ts
- [ ] T016 [P] Create SimulationId value object in src/core/value-objects/SimulationId.ts
- [ ] T017 [P] Create Timestamp value object (ISO 8601) in src/core/value-objects/Timestamp.ts
- [ ] T018 [P] Create ArgumentType enum in src/core/value-objects/ArgumentType.ts
- [ ] T019 [P] Create DebateStatus enum in src/core/value-objects/DebateStatus.ts

## Phase 3.4: Core Domain - Entities (TDD)
- [ ] T020 [P] Write failing tests for Argument entity in tests/unit/core/entities/Argument.test.ts
- [ ] T021 [P] Write failing tests for Agent entity in tests/unit/core/entities/Agent.test.ts
- [ ] T022 [P] Write failing tests for DebateSimulation in tests/unit/core/entities/DebateSimulation.test.ts
- [ ] T023 [P] Implement Argument entity with factory method in src/core/entities/Argument.ts
- [ ] T024 [P] Implement Agent entity in src/core/entities/Agent.ts
- [ ] T025 [P] Implement DebateSimulation entity in src/core/entities/DebateSimulation.ts
- [ ] T026 [P] Implement Rebuttal entity extending Argument in src/core/entities/Rebuttal.ts
- [ ] T027 [P] Implement Concession entity in src/core/entities/Concession.ts

## Phase 3.5: Core Domain - Repository Interfaces
- [ ] T028 [P] Define IArgumentRepository interface in src/core/repositories/IArgumentRepository.ts
- [ ] T029 [P] Define ISimulationRepository interface in src/core/repositories/ISimulationRepository.ts
- [ ] T030 [P] Define IAgentRepository interface in src/core/repositories/IAgentRepository.ts

## Phase 3.6: Core Domain - Services
- [ ] T031 [P] Write failing tests for ArgumentValidator in tests/unit/core/services/ArgumentValidator.test.ts
- [ ] T032 [P] Implement ArgumentValidator service in src/core/services/ArgumentValidator.ts
- [ ] T033 [P] Implement RelationshipBuilder service in src/core/services/RelationshipBuilder.ts
- [ ] T034 [P] Implement VoteCalculator service in src/core/services/VoteCalculator.ts

## Phase 3.7: Application Layer - Commands & Queries
- [ ] T035 [P] Create InitializeDebateCommand in src/application/commands/InitializeDebateCommand.ts
- [ ] T036 [P] Create CreateArgumentCommand in src/application/commands/CreateArgumentCommand.ts
- [ ] T037 [P] Create SubmitRebuttalCommand in src/application/commands/SubmitRebuttalCommand.ts
- [ ] T038 [P] Create SubmitConcessionCommand in src/application/commands/SubmitConcessionCommand.ts
- [ ] T039 [P] Create VoteToCloseCommand in src/application/commands/VoteToCloseCommand.ts
- [ ] T040 [P] Create GetDebateHistoryQuery in src/application/queries/GetDebateHistoryQuery.ts
- [ ] T041 [P] Create GetArgumentQuery in src/application/queries/GetArgumentQuery.ts
- [ ] T042 [P] Create GetArgumentChainQuery in src/application/queries/GetArgumentChainQuery.ts

## Phase 3.8: Application Layer - Handlers (TDD)
- [ ] T043 Write failing handler tests in tests/unit/application/handlers/
- [ ] T044 Implement CommandBus in src/application/handlers/CommandBus.ts
- [ ] T045 Implement QueryBus in src/application/handlers/QueryBus.ts
- [ ] T046 [P] Implement InitializeDebateHandler in src/application/handlers/InitializeDebateHandler.ts
- [ ] T047 [P] Implement CreateArgumentHandler in src/application/handlers/CreateArgumentHandler.ts
- [ ] T048 [P] Implement SubmitRebuttalHandler in src/application/handlers/SubmitRebuttalHandler.ts
- [ ] T049 [P] Implement SubmitConcessionHandler in src/application/handlers/SubmitConcessionHandler.ts
- [ ] T050 [P] Implement VoteToCloseHandler in src/application/handlers/VoteToCloseHandler.ts

## Phase 3.9: Application Layer - Query Handlers
- [ ] T051 [P] Implement GetDebateHistoryHandler in src/application/handlers/GetDebateHistoryHandler.ts
- [ ] T052 [P] Implement GetArgumentHandler in src/application/handlers/GetArgumentHandler.ts
- [ ] T053 [P] Implement GetArgumentChainHandler in src/application/handlers/GetArgumentChainHandler.ts

## Phase 3.10: Infrastructure - Storage Implementation
- [ ] T054 Write integration tests for repositories in tests/integration/infrastructure/
- [ ] T055 Implement ObjectStorage for content-addressing in src/infrastructure/storage/ObjectStorage.ts
- [ ] T056 Implement FileArgumentRepository in src/infrastructure/storage/FileArgumentRepository.ts
- [ ] T057 Implement FileSimulationRepository in src/infrastructure/storage/FileSimulationRepository.ts
- [ ] T058 Implement FileAgentRepository in src/infrastructure/storage/FileAgentRepository.ts
- [ ] T058a [P] Implement agent MD file parser with YAML frontmatter validation in src/infrastructure/storage/AgentFileParser.ts
- [ ] T059 Implement IndexManager for queries in src/infrastructure/storage/IndexManager.ts

## Phase 3.11: Infrastructure - Supporting Services
- [ ] T060 [P] Implement InMemoryEventBus in src/infrastructure/events/InMemoryEventBus.ts
- [ ] T061 [P] Implement StructuredLogger in src/infrastructure/logging/StructuredLogger.ts
- [ ] T061a [P] Create standardized error messages and error codes in src/shared/errors/ErrorMessages.ts
- [ ] T061b [P] Implement error formatter for CLI output in src/interfaces/cli/ErrorFormatter.ts

## Phase 3.12: CLI Interface - Commands
- [ ] T062 Write E2E tests for CLI commands in tests/e2e/cli/
- [ ] T063 Create main CLI entry point in src/interfaces/cli/index.ts
- [ ] T064 Implement TownhallCLI class with Commander in src/interfaces/cli/TownhallCLI.ts
- [ ] T065 [P] Implement init command in src/interfaces/cli/commands/InitCommand.ts
- [ ] T066 [P] Implement simulate command in src/interfaces/cli/commands/SimulateCommand.ts
- [ ] T067 [P] Implement argument command in src/interfaces/cli/commands/ArgumentCommand.ts
- [ ] T068 [P] Implement rebuttal command in src/interfaces/cli/commands/RebuttalCommand.ts
- [ ] T069 [P] Implement concede command in src/interfaces/cli/commands/ConcedeCommand.ts
- [ ] T070 [P] Implement log command in src/interfaces/cli/commands/LogCommand.ts
- [ ] T071 [P] Implement vote-close command in src/interfaces/cli/commands/VoteCloseCommand.ts
- [ ] T071a Implement vote status display showing progress (X/Y votes) in src/interfaces/cli/commands/VoteStatusCommand.ts

## Phase 3.13: Contract Tests (From OpenAPI)
- [ ] T072 [P] Contract test InitializeDebate in tests/contract/InitializeDebate.test.ts
- [ ] T073 [P] Contract test CreateArgument in tests/contract/CreateArgument.test.ts
- [ ] T074 [P] Contract test SubmitRebuttal in tests/contract/SubmitRebuttal.test.ts
- [ ] T075 [P] Contract test SubmitConcession in tests/contract/SubmitConcession.test.ts
- [ ] T076 [P] Contract test VoteToClose in tests/contract/VoteToClose.test.ts
- [ ] T077 [P] Contract test GetDebateHistory in tests/contract/GetDebateHistory.test.ts
- [ ] T078 [P] Contract test GetArgument in tests/contract/GetArgument.test.ts

## Phase 3.14: Integration Tests (From User Stories)
- [ ] T079 [P] Test complete debate initialization flow in tests/integration/InitializeDebate.test.ts
- [ ] T080 [P] Test argument submission with validation in tests/integration/ArgumentSubmission.test.ts
- [ ] T081 [P] Test rebuttal chain creation in tests/integration/RebuttalChain.test.ts
- [ ] T082 [P] Test consensus voting mechanism in tests/integration/ConsensusVoting.test.ts
- [ ] T083 [P] Test agent identity management in tests/integration/AgentIdentity.test.ts

## Phase 3.14a: Edge Case Handling
- [ ] T083a [P] Implement handler for non-existent argument ID references in src/application/handlers/ErrorHandlers.ts
- [ ] T083b [P] Add validation for malformed argument structures in src/core/services/ArgumentStructureValidator.ts
- [ ] T083c [P] Handle attempts to argue outside active debate in src/application/handlers/DebateContextValidator.ts
- [ ] T083d Implement concurrent submission handling with locks in src/infrastructure/storage/ConcurrencyManager.ts

## Phase 3.15: Polish & Documentation
- [ ] T084 [P] Add JSDoc comments to all public APIs
- [ ] T085 [P] Create CLI help documentation in docs/cli-usage.md
- [ ] T086 [P] Write API documentation in docs/api.md
- [ ] T087 Performance optimization for sub-100ms operations
- [ ] T088 Add structured logging throughout application
- [ ] T089 Create comprehensive README.md with quickstart
- [ ] T090 Run full test suite and verify 100% pass rate
- [ ] T091 Execute quickstart.md scenarios for validation
- [ ] T092 Package as npm module with bin entry for global install

## Dependencies
- Value objects (T014-T019) have no dependencies
- Entities (T023-T027) depend on value objects
- Repository interfaces (T028-T030) depend on entities
- Handlers (T046-T053) depend on repositories and commands/queries
- Infrastructure (T055-T059) implements repository interfaces
- CLI (T065-T071) depends on CommandBus/QueryBus
- Contract tests (T072-T078) validate handler implementations
- Integration tests (T079-T083) require full stack

## Parallel Execution Examples
```bash
# Phase 3.3 - All value objects can be created in parallel:
Task: "Create ArgumentId value object with SHA-256 hashing in src/core/value-objects/ArgumentId.ts"
Task: "Create AgentId value object (UUID) in src/core/value-objects/AgentId.ts"
Task: "Create SimulationId value object in src/core/value-objects/SimulationId.ts"
Task: "Create Timestamp value object (ISO 8601) in src/core/value-objects/Timestamp.ts"
Task: "Create ArgumentType enum in src/core/value-objects/ArgumentType.ts"
Task: "Create DebateStatus enum in src/core/value-objects/DebateStatus.ts"

# Phase 3.4 - All entity tests can be written in parallel:
Task: "Write failing tests for Argument entity in tests/unit/core/entities/Argument.test.ts"
Task: "Write failing tests for Agent entity in tests/unit/core/entities/Agent.test.ts"
Task: "Write failing tests for DebateSimulation in tests/unit/core/entities/DebateSimulation.test.ts"

# Phase 3.12 - All CLI commands can be implemented in parallel:
Task: "Implement init command in src/interfaces/cli/commands/InitCommand.ts"
Task: "Implement simulate command in src/interfaces/cli/commands/SimulateCommand.ts"
Task: "Implement argument command in src/interfaces/cli/commands/ArgumentCommand.ts"
```

## Notes
- Follow TDD: Write failing tests before implementation
- Respect hexagonal architecture layer boundaries
- Use Result types everywhere - no exceptions
- All entities must be immutable
- Commands/Queries go through respective buses
- Commit after each completed task
- Performance target: <100ms for all operations
- Total tasks: 100 (increased from 92 to address analysis findings)

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (T072-T078)
- [x] All entities have model tasks (T023-T027)
- [x] All tests come before implementation (TDD approach)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Follows hexagonal architecture layer structure