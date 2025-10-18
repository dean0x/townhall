# Townhall CLI Commands Reference

**Version**: 1.0.0 (Phase 1 MVP)
**Generated**: 2025-01-26
**Status**: Final Specification

## Overview

Townhall provides a Git-inspired CLI for structured agent debate simulations. All commands follow a consistent pattern and return clear error messages for invalid operations.

## Command Structure

### 1. `townhall init` - Initialize Repository

Initializes a new Townhall repository in the current directory.

```bash
townhall init
```

**Creates:**
- `.townhall/` directory structure
- `objects/` for content-addressed storage
- `refs/` for simulation references
- `agents/` for agent definitions
- `index/` for query optimization

**Example:**
```bash
$ townhall init
✓ Initialized Townhall repository in .townhall/
```

---

### 2. `townhall simulate` - Start Debate

Starts a new debate simulation with a given topic. Only one debate can be active system-wide.

```bash
townhall simulate debate "<topic>"
```

**Parameters:**
- `<topic>`: The debate topic (1-500 characters)

**Example:**
```bash
$ townhall simulate debate "Should AI be regulated?"
✓ Debate initialized: abc123def456...
Topic: Should AI be regulated?
Status: active
```

---

### 3. `townhall argument` - Submit Argument

Submits a structured argument to the active debate. Supports three types: deductive, inductive, and empirical.

#### Deductive Arguments
Requires minimum 2 premises and a conclusion.

```bash
townhall argument --agent <agent-id> --type deductive \
  --premise "<premise-1>" \
  --premise "<premise-2>" \
  [--premise "<premise-n>"] \
  --conclusion "<conclusion>"
```

#### Inductive Arguments
Requires minimum 2 observations and a generalization.

```bash
townhall argument --agent <agent-id> --type inductive \
  --observation "<observation-1>" \
  --observation "<observation-2>" \
  [--observation "<observation-n>"] \
  --generalization "<generalization>" \
  [--confidence <0-1>]
```

#### Empirical Arguments
Requires evidence and a claim.

```bash
townhall argument --agent <agent-id> --type empirical \
  --evidence "<source>" \
  [--citation "<reference>"] \
  --claim "<claim>" \
  [--methodology "<method>"]
```

**Common Parameters:**
- `--agent <agent-id>`: UUID of the agent (from MD file frontmatter)
- `--type <type>`: Argument type (deductive|inductive|empirical)

**Example:**
```bash
$ townhall argument --agent 550e8400-e29b --type deductive \
    --premise "All humans are mortal" \
    --premise "Socrates is human" \
    --conclusion "Socrates is mortal"
✓ Argument created: def789abc123
Agent: Socrates
Type: Deductive
ID: def789abc123... (short: def789a)
```

---

### 4. `townhall rebuttal` - Rebut Argument

Creates a rebuttal that challenges an existing argument.

```bash
townhall rebuttal --agent <agent-id> --target <argument-sha> \
  --type <rebuttal-type> \
  [argument structure based on argument type]
```

**Parameters:**
- `--agent <agent-id>`: UUID of the rebutter
- `--target <sha>`: Argument to rebut (full SHA or 7+ char prefix)
- `--type <type>`: Rebuttal type (logical|empirical|methodological)

**Example:**
```bash
$ townhall rebuttal --agent 550e8400-e29c --target def789a \
    --type logical \
    --premise "Not all swans are white" \
    --premise "Black swans exist in Australia" \
    --conclusion "The generalization is false"
✓ Rebuttal created: 789xyz456abc
Responding to: def789a
Agent: Aristotle
```

---

### 5. `townhall concede` - Concede to Argument

Acknowledges the validity of another agent's argument.

```bash
townhall concede --agent <agent-id> --target <argument-sha> \
  --type <concession-type> \
  [--conditions "<conditions>"] \
  [--explanation "<reason>"]
```

**Parameters:**
- `--agent <agent-id>`: UUID of conceding agent
- `--target <sha>`: Argument to concede to
- `--type <type>`: Concession type (full|partial|conditional)
- `--conditions`: Required if type is conditional
- `--explanation`: Optional reasoning

**Example:**
```bash
$ townhall concede --agent 550e8400-e29b --target 789xyz4 \
    --type partial \
    --explanation "Valid concern about edge cases"
✓ Concession recorded: abc456def789
Agent: Socrates
Conceding to: 789xyz4 (partial)
```

---

### 6. `townhall log` - View Debate History

Displays the debate history with various formatting options.

```bash
townhall log [options]
```

**Options:**
- `--graph`: Show argument relationships as tree
- `--agent <agent-id>`: Filter by specific agent
- `--type <type>`: Filter by argument type
- `--limit <n>`: Limit number of entries
- `--json`: Output as JSON

**Example:**
```bash
$ townhall log --graph
Debate: Should AI be regulated? [active]

def789a (Socrates: deductive)
├── 789xyz4 (Aristotle: rebuttal)
│   └── abc456d (Socrates: concession-partial)
└── xyz123b (Plato: support)
```

---

### 7. `townhall vote` - Vote on Debate Closure

Vote to close the active debate. Requires consensus from all participating agents.

```bash
townhall vote --yes [--reason "<reason>"]
townhall vote --no [--reason "<reason>"]
townhall vote --status
```

**Options:**
- `--yes`: Vote to close debate
- `--no`: Vote against closing
- `--status`: Check current vote tally
- `--reason`: Optional explanation for vote

**Example:**
```bash
$ townhall vote --yes --reason "Key points have been addressed"
✓ Vote recorded
Votes to close: 2/3
Status: voting

$ townhall vote --status
Debate: Should AI be regulated?
Status: voting
Votes to close: 2/3
Needed for consensus: 1 more vote
```

---

## Agent Management

Agents must be pre-created as Markdown files with YAML frontmatter in `.townhall/agents/`:

```markdown
---
id: 550e8400-e29b-41d4-a716-446655440001
name: Socrates
type: human
capabilities: [debate, analysis, logic]
---
A classical philosopher focused on logical reasoning and the Socratic method.
```

## Argument References

Arguments use Git-style content-addressed references:
- **Full SHA**: 64-character SHA-256 hash
- **Short SHA**: First 7+ characters (auto-expanded if unique)

## Error Handling

All commands return structured errors:
- `ERROR: No active debate` - Start a debate first
- `ERROR: Agent not found` - Check agent ID exists
- `ERROR: Invalid argument structure` - Check type requirements
- `ERROR: Argument not found` - Verify SHA reference
- `ERROR: Duplicate vote` - Agent already voted

## Performance Targets

- Argument logging: <100ms
- Query operations: <50ms
- All operations use Result types (no exceptions thrown)

## Exit Codes

- `0`: Success
- `1`: Invalid arguments/options
- `2`: Missing prerequisites (no active debate, agent not found)
- `3`: Operation failed (storage error, etc.)

---

## Quick Reference Card

| Command | Purpose | Key Options |
|---------|---------|-------------|
| `init` | Initialize repository | - |
| `simulate debate` | Start new debate | `<topic>` |
| `argument` | Submit argument | `--type`, `--agent` |
| `rebuttal` | Challenge argument | `--target`, `--type` |
| `concede` | Accept argument | `--target`, `--type` |
| `log` | View history | `--graph`, `--agent` |
| `vote` | Close debate | `--yes`, `--no`, `--status` |

## Implementation Notes

- All commands translate to CQRS commands/queries via CommandBus
- Immutable storage using content-addressing (like Git)
- TypeScript with strict mode, Zod validation at boundaries
- Hexagonal architecture: CLI is a thin adapter layer
- Result<T,E> types throughout (using neverthrow library)