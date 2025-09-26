<!-- Sync Impact Report
Version change: 0.0.0 → 1.0.0 (Initial constitution)
Added principles:
  - I. Hexagonal Architecture
  - II. Result-Based Error Handling
  - III. Functional Core, Imperative Shell
  - IV. Test-Driven Development
  - V. Type Safety First
  - VI. Multi-Interface Ready
  - VII. Immutability by Default
Added sections:
  - Architecture Standards
  - Code Quality Standards
Templates requiring updates: ⚠ pending
  - .specify/templates/plan-template.md (needs constitution gates)
  - .specify/templates/spec-template.md (aligned with principles)
  - .specify/templates/tasks-template.md (aligned with TDD)
Follow-up TODOs: None
-->

# Townhall Constitution

## Core Principles

### I. Hexagonal Architecture (NON-NEGOTIABLE)

The codebase MUST follow hexagonal/clean architecture with strict layer dependencies:
Core → Nothing, Application → Core, Infrastructure → Core/Application, Interfaces → Application.
Core domain logic MUST have zero dependencies on infrastructure or frameworks. All I/O operations
MUST be abstracted behind interface definitions in the core layer. This ensures business logic
remains pure, testable, and framework-agnostic.

**Rationale**: Prevents architectural decay and enables swapping implementations without touching
business logic, crucial for supporting CLI, MCP, REST API, and SDK interfaces from the same core.

### II. Result-Based Error Handling (NO EXCEPTIONS)

All business logic MUST use Result<T, E> types for error handling. Functions in the core and
application layers MUST NEVER throw exceptions. Errors must be explicitly modeled as part of
the function signature. Every error path must be handled explicitly by the caller.

**Rationale**: Exceptions hide control flow and make testing difficult. Result types make error
paths explicit, composable, and force developers to handle all failure scenarios.

### III. Functional Core, Imperative Shell

Business logic MUST be implemented as pure functions that return new values without side effects.
All I/O, mutations, and side effects MUST be isolated to the infrastructure and interface layers.
Domain entities MUST be immutable with factory methods and return new instances for modifications.

**Rationale**: Pure functions are deterministic, easily testable, and composable. Separating pure
logic from side effects simplifies reasoning about code behavior and enables property-based testing.

### IV. Test-Driven Development (MANDATORY)

Tests MUST be written before implementation following Red-Green-Refactor cycle. Every feature
MUST have: unit tests for domain logic (70%), integration tests for repositories/handlers (20%),
and end-to-end tests for user workflows (10%). Tests must validate behavior, not implementation.

**Rationale**: TDD ensures requirements are understood before coding, prevents over-engineering,
and provides immediate feedback on design quality. Behavioral tests survive refactoring.

### V. Type Safety First

TypeScript strict mode MUST be enabled with all strict flags. The `any` type is FORBIDDEN except
in generic constraints. All data at system boundaries MUST be validated using schemas (Zod).
Domain concepts MUST use branded types to prevent primitive obsession.

**Rationale**: Type safety catches errors at compile time, documents intent, enables confident
refactoring, and prevents entire categories of runtime errors.

### VI. Multi-Interface Ready

All user operations MUST go through Command/Query pattern via CommandBus/QueryBus. Every interface
(CLI, API, MCP, SDK) MUST be a thin translator to commands/queries. Business logic MUST NEVER
know about specific interfaces. New interfaces must require only translation layer additions.

**Rationale**: Ensures consistency across all interfaces and prevents business logic from leaking
into presentation layers. Adding new interfaces becomes trivial.

### VII. Immutability by Default

All data structures MUST be immutable by default using `readonly` modifiers. Arrays must use
`readonly T[]`. Object updates MUST return new instances. State mutations are only allowed in
infrastructure layer with explicit documentation.

**Rationale**: Immutable data prevents bugs from unexpected mutations, enables safe concurrent
access, simplifies debugging, and aligns with functional programming principles.

## Architecture Standards

### Layer Structure
The codebase MUST maintain four distinct layers:
- **Core** (`/src/core`): Entities, value objects, repository interfaces, domain services
- **Application** (`/src/application`): Commands, queries, handlers, application ports
- **Infrastructure** (`/src/infrastructure`): Repository implementations, external services
- **Interfaces** (`/src/interfaces`): CLI, API, MCP, SDK adapters

### Dependency Injection
All dependencies MUST be injected via constructor parameters. Direct instantiation of
dependencies is FORBIDDEN. Use TSyringe or similar DI container for wiring. Interfaces
must be defined in core/application, implementations in infrastructure.

### Content Addressing
Following Git's model, all simulation data MUST use content-addressed storage with SHA-256
hashing. Objects must be immutable once created. References between objects use content hashes
to ensure integrity.

## Code Quality Standards

### Naming Conventions
- Types/Interfaces: PascalCase (e.g., `UserProfile`, `ArgumentRepository`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `MAX_RETRY_ATTEMPTS`)
- Functions/Variables: camelCase (e.g., `calculateScore`, `userName`)
- Files: kebab-case for modules, PascalCase for classes

### Documentation Requirements
Every public API MUST have JSDoc comments with:
- Description of purpose
- @param tags for all parameters
- @returns tag describing return value and Result error types
- @example showing typical usage

### Performance Standards
- Async operations MUST run in parallel when possible using Promise.all()
- Database queries MUST be batched to avoid N+1 problems
- Memory leaks MUST be prevented with proper cleanup in finally blocks
- WeakMap MUST be used for object metadata to allow garbage collection

### Security Requirements
- NEVER commit secrets, API keys, or credentials to the repository
- All user input MUST be validated at system boundaries
- Use environment variables for configuration, never hardcode
- Implement rate limiting for all public interfaces

## Governance

### Amendment Process
Constitutional amendments require:
1. Documented rationale for the change
2. Impact assessment on existing codebase
3. Migration plan for affected code
4. Review and approval via pull request
5. Version bump according to semantic versioning

### Version Policy
- MAJOR: Removing principles or incompatible changes
- MINOR: Adding new principles or sections
- PATCH: Clarifications and wording improvements

### Compliance
- All pull requests MUST verify constitutional compliance
- Architecture violations MUST be fixed before merge
- Deviations require explicit documentation and justification
- Use CLAUDE.md for runtime development guidance

**Version**: 1.0.0 | **Ratified**: 2025-01-25 | **Last Amended**: 2025-01-25