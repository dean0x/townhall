# Townhall CLI

A Git-inspired CLI for structured agent debate simulations with content-addressed storage.

## Installation

```bash
# Install globally
npm install -g @townhall/cli

# Or use locally
npm install @townhall/cli
```

## Quick Start

```bash
# Initialize a new Townhall repository
townhall init

# Start a debate simulation
townhall simulate debate "Should AI be regulated?"

# Submit arguments
townhall argument --agent <uuid> --type deductive \
  --premise "AI has societal impact" \
  --premise "Societal impact requires oversight" \
  --conclusion "AI should be regulated"

# View debate history
townhall log

# Submit rebuttals
townhall rebuttal --target <arg-id> --agent <uuid> \
  --type logical --argument-type deductive \
  --premise "Regulation can stifle innovation" \
  --conclusion "Minimal regulation is preferable"

# Concede points
townhall concede --target <arg-id> --agent <uuid> \
  --reason "convinced"

# Vote to close debate
townhall vote --agent <uuid>
```

## Features

- **Git-like Storage**: Content-addressed immutable storage with SHA-256 hashing
- **Structured Arguments**: Support for deductive, inductive, and empirical argument types
- **Agent Management**: YAML frontmatter in Markdown files for agent definitions
- **Debate Tracking**: Single active debate with full history
- **Relationship Mapping**: Track rebuttals, concessions, and support chains
- **Short Hash Support**: Use Git-like short hashes for convenient references

## Architecture

Built with hexagonal architecture and CQRS pattern:

```
src/
├── core/           # Pure domain logic
├── application/    # Use cases and handlers
├── infrastructure/ # External implementations
└── interfaces/     # CLI adapter
```

## Agent Definition

Create agent files in `.townhall/agents/` with YAML frontmatter:

```markdown
---
id: f05482e4-324d-4b50-8be3-a49f870cd968
name: Alice
type: llm
capabilities: [debate, reasoning, analysis]
model: gpt-4
---

# Alice - Logical Reasoning Agent

Alice specializes in logical reasoning and structured argumentation...
```

## Commands Reference

### `townhall init`
Initialize a new Townhall repository in the current directory.

### `townhall simulate debate <topic>`
Start a new debate simulation with the specified topic.

### `townhall argument`
Submit a structured argument to the active debate.

Options:
- `--agent <uuid>`: Agent UUID
- `--type <type>`: Argument type (deductive, inductive, empirical)
- `--premise <premise...>`: Premises (for deductive)
- `--conclusion <text>`: Conclusion (for deductive)
- `--observation <obs...>`: Observations (for inductive)
- `--generalization <text>`: Generalization (for inductive)
- `--evidence <evidence...>`: Evidence (for empirical)
- `--claim <text>`: Claim (for empirical)

### `townhall rebuttal`
Submit a rebuttal to an existing argument.

Options:
- `--target <id>`: Target argument ID (full or short hash)
- `--agent <uuid>`: Agent UUID
- `--type <type>`: Rebuttal type (logical, empirical, methodological)
- `--argument-type <type>`: Argument structure type
- Additional argument options based on argument type

### `townhall concede`
Concede a point to another argument.

Options:
- `--target <id>`: Target argument ID
- `--agent <uuid>`: Agent UUID
- `--reason <text>`: Reason (convinced, evidence, logic-superior)
- `--acknowledgement <text>`: Optional acknowledgement

### `townhall log`
View debate history.

Options:
- `--graph`: Show argument relationships as tree
- `--agent <uuid>`: Filter by specific agent
- `--type <type>`: Filter by argument type
- `--limit <number>`: Limit number of entries
- `--json`: Output as JSON

### `townhall vote`
Vote to close the current debate.

Options:
- `--agent <uuid>`: Agent UUID
- `--reason <text>`: Optional reason for closure

## Repository Structure

After initialization, Townhall creates:

```
.townhall/
├── objects/       # Content-addressed storage
├── refs/          # Active debate reference
├── index/         # Query optimization
└── agents/        # Agent definition files (MD)
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint

# Format code
npm run format
```

## Architecture Principles

- **Hexagonal Architecture**: Strict layer separation
- **CQRS Pattern**: Command/Query separation
- **Result Types**: No exceptions in business logic
- **Dependency Injection**: TSyringe for IoC
- **Immutable Entities**: Factory methods and freezing
- **Content-Addressed**: Git-like SHA-256 storage

## License

MIT

## Contributing

Contributions are welcome! Please ensure:
- All tests pass
- TypeScript compiles without errors
- Code follows existing patterns
- Documentation is updated