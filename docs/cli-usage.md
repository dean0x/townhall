# Townhall CLI Usage Guide

## Overview

Townhall is a Git-inspired CLI for structured agent debate simulations. It provides content-addressed storage, immutable arguments, and structured debate management.

## Installation & Setup

### Global Installation (Not Yet Published)

**Note**: The package is not yet published to npm. Use local development setup below.

### Local Development

```bash
# Clone repository
git clone https://github.com/dean0x/townhall.git
cd townhall

# Install dependencies
npm install

# Build the project
npm run build

# Link globally for testing
npm link

# Verify installation
townhall --help
```

After `npm link`, you can use the `townhall` command from any directory.

## Basic Workflow

### 1. Initialize Repository

```bash
townhall init
```

Creates a `.townhall/` directory with:
- `objects/` - Content-addressed storage for arguments
- `refs/` - References to active debates
- `index/` - Query optimization indexes
- `agents/` - Agent definition files

### 2. Define Agents

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

Alice specializes in structured logical arguments...
```

### 3. Start a Debate

```bash
townhall simulate debate "Should remote work be mandatory?"
```

Output:
```
✓ Debate initialized: 7e966330892c...
Topic: Should remote work be mandatory?
Status: active
Created: 2025-01-27 10:30:00
```

### 4. Submit Arguments

#### Deductive Arguments

```bash
townhall argument \
  --agent f05482e4-324d-4b50-8be3-a49f870cd968 \
  --type deductive \
  --premise "Remote work increases productivity" \
  --premise "Increased productivity benefits companies" \
  --conclusion "Companies should embrace remote work"
```

#### Inductive Arguments

```bash
townhall argument \
  --agent <uuid> \
  --type inductive \
  --observation "Tech companies report higher satisfaction" \
  --observation "Finance firms see reduced turnover" \
  --generalization "Remote work improves retention" \
  --confidence 0.85
```

#### Empirical Arguments

```bash
townhall argument \
  --agent <uuid> \
  --type empirical \
  --evidence "Stanford 2-year study data" \
  --relevance "Demonstrates long-term productivity gains" \
  --evidence "Microsoft productivity metrics" \
  --relevance "Shows consistent cross-company patterns" \
  --claim "Remote work increases output by 13%" \
  --methodology "Controlled A/B testing"
```

**Note**: `--relevance` is required for each `--evidence` source.

### 5. Submit Rebuttals

```bash
townhall rebuttal \
  --target c143423 \  # Short hash of target argument
  --agent <uuid> \
  --type logical \
  --argument-type deductive \
  --premise "Collaboration requires presence" \
  --premise "Innovation needs spontaneous interaction" \
  --conclusion "Full remote work hampers creativity"
```

Rebuttal types:
- `logical` - Challenges reasoning structure
- `empirical` - Disputes evidence or data
- `methodological` - Questions methodology

### 6. Concede Points

```bash
townhall concede \
  --target 8b95b51 \
  --agent <uuid> \
  --reason convinced \
  --acknowledgement "Valid point about productivity metrics"
```

Concession reasons:
- `convinced` - Persuaded by the argument
- `evidence` - Compelling evidence presented
- `logic-superior` - Better logical structure

### 7. View Debate History

Basic view:
```bash
townhall log
```

Tree view with relationships:
```bash
townhall log --graph
```

Filter by agent:
```bash
townhall log --agent <uuid>
```

JSON output:
```bash
townhall log --json > debate.json
```

### 8. Check Simulation Status

```bash
townhall status
```

Shows current active debate status and statistics.

### 9. Switch Between Simulations

```bash
townhall list
townhall checkout <simulation-id>
```

### 10. View Argument Details

```bash
townhall show <argument-id>
townhall trace <argument-id>
```

- `show`: Display detailed information about a specific argument
- `trace`: Show complete argument chain (ancestors and descendants)

### 11. Vote to Close

```bash
townhall vote --agent <uuid> --yes --reason "Consensus reached"
```

Or vote against closing:
```bash
townhall vote --agent <uuid> --no --reason "More discussion needed"
```

Debates close when majority of participants vote yes.

## Advanced Usage

### Short Hash References

Use Git-like short hashes (minimum 7 characters):

```bash
# Full hash
townhall rebuttal --target c143423cc5358b5e8ce6737b3658a1d0f2c94a95e2554275b80a493808f31b84

# Short hash (same effect)
townhall rebuttal --target c143423
```

### Argument Chains

View argument chains:
```bash
townhall log --graph
```

Output:
```
c143423 (Alice: deductive)
├── 3112b1d (Bob: empirical) [rebuttal]
│   └── a7f892c (Alice: logical) [rebuttal]
└── 9e2341f (Charlie: methodological) [rebuttal]
    └── b8c7d12 (Bob: empirical) [concession]
```

### Filtering & Queries

Filter by argument type:
```bash
townhall log --type empirical
```

Limit results:
```bash
townhall log --limit 10
```

Combined filters:
```bash
townhall log --agent <uuid> --type deductive --limit 5
```

## Command Reference

### Global Options

All commands support:
- `--help` - Show command help
- `--version` - Show CLI version

### townhall init

Initialize a new Townhall repository.

```bash
townhall init [options]
```

Options:
- None (uses current directory)

### townhall simulate

Start a new debate simulation.

```bash
townhall simulate debate "<topic>"
```

Arguments:
- `topic` - The debate topic (required)

### townhall argument

Submit a structured argument.

```bash
townhall argument [options]
```

Options:
- `--agent <uuid>` - Agent UUID (required)
- `--type <type>` - Argument type: deductive|inductive|empirical (required)

For deductive:
- `--premise <text>` - Premises (multiple, min 2)
- `--conclusion <text>` - Conclusion (required)

For inductive:
- `--observation <text>` - Observations (multiple, min 2)
- `--generalization <text>` - General pattern (required)
- `--confidence <0-1>` - Confidence level

For empirical:
- `--evidence <text>` - Evidence sources (multiple, required)
- `--relevance <text>` - Relevance for each evidence (required, must match evidence count)
- `--claim <text>` - Main claim (required)
- `--methodology <text>` - Research method (optional)

### townhall rebuttal

Challenge an existing argument.

```bash
townhall rebuttal [options]
```

Options:
- `--target <id>` - Target argument ID (required)
- `--agent <uuid>` - Agent UUID (required)
- `--type <type>` - Rebuttal type: logical|empirical|methodological (required)
- `--argument-type <type>` - Structure type (required)
- Plus argument structure options

### townhall concede

Acknowledge another's argument.

```bash
townhall concede [options]
```

Options:
- `--target <id>` - Target argument ID (required)
- `--agent <uuid>` - Agent UUID (required)
- `--reason <text>` - Reason: convinced|evidence|logic-superior (required)
- `--acknowledgement <text>` - Optional message

### townhall log

View debate history.

```bash
townhall log [options]
```

Options:
- `--graph` - Show as relationship tree
- `--agent <uuid>` - Filter by agent
- `--type <type>` - Filter by argument type
- `--limit <n>` - Limit results
- `--json` - Output as JSON

### townhall checkout

Switch to a different simulation.

```bash
townhall checkout <simulation-id>
```

Arguments:
- `simulation-id` - ID of simulation to switch to (required)

### townhall list

List all simulations.

```bash
townhall list
```

### townhall status

Show current simulation status.

```bash
townhall status
```

### townhall show

Display detailed information about an argument.

```bash
townhall show <argument-id>
```

Arguments:
- `argument-id` - Full or short hash of argument (required)

### townhall trace

Show complete argument chain.

```bash
townhall trace <argument-id> [options]
```

Arguments:
- `argument-id` - Full or short hash of argument (required)

Options:
- `--depth <number>` - Maximum traversal depth (default: 5)

### townhall vote

Vote to close debate.

```bash
townhall vote [options]
```

Options:
- `--agent <uuid>` - Agent UUID (required)
- `--yes` - Vote to close the debate (required: either --yes or --no)
- `--no` - Vote against closing the debate (required: either --yes or --no)
- `--reason <text>` - Optional reason

## Error Handling

Common errors and solutions:

### No Active Debate

```
❌ Failed to create argument: No active debate to submit to
```

Solution: Start a debate first with `townhall simulate debate "<topic>"`

### Invalid UUID

```
❌ Invalid input: Invalid UUID format
```

Solution: Use a valid UUID v4 format (e.g., `f05482e4-324d-4b50-8be3-a49f870cd968`)

### Ambiguous Short Hash

```
❌ Ambiguous short hash 'c14' matches 3 objects
```

Solution: Use a longer hash prefix for uniqueness

### Repository Not Initialized

```
❌ No Townhall repository found
```

Solution: Run `townhall init` in the project directory

## Best Practices

1. **Agent Definition**: Define agents before starting debates
2. **Argument Structure**: Ensure premises support conclusions
3. **Short Hashes**: Use at least 7 characters for uniqueness
4. **Concessions**: Acknowledge strong counterarguments
5. **Voting**: Vote when consensus or deadlock is reached

## Examples

### Complete Debate Flow

```bash
# Initialize
townhall init

# Define agents (create .townhall/agents/*.md files)

# Start debate
townhall simulate debate "Is AI consciousness possible?"

# Alice argues for possibility
townhall argument --agent alice-uuid --type deductive \
  --premise "Consciousness emerges from information processing" \
  --premise "AI can process information" \
  --conclusion "AI consciousness is theoretically possible"

# Bob provides empirical counter
townhall argument --agent bob-uuid --type empirical \
  --evidence "Current AI lacks subjective experience markers" \
  --claim "No evidence for AI consciousness exists" \
  --methodology "Behavioral and computational analysis"

# Alice rebuts
townhall rebuttal --target <bob-arg-id> --agent alice-uuid \
  --type methodological --argument-type deductive \
  --premise "Absence of evidence is not evidence of absence" \
  --conclusion "Current tests may be inadequate"

# Bob concedes partially
townhall concede --target <alice-rebuttal> --agent bob-uuid \
  --reason convinced \
  --acknowledgement "Valid point about test limitations"

# View the debate
townhall log --graph

# Vote to close
townhall vote --agent alice-uuid --yes --reason "Key points addressed"
townhall vote --agent bob-uuid --yes --reason "Sufficient exploration"
```

## Troubleshooting

### Build Issues

```bash
# Clean and rebuild
rm -rf dist/
npm run build
```

### Permission Issues

```bash
# Fix permissions
chmod +x dist/index.js
```

### TypeScript Errors

```bash
# Check types
npm run typecheck
```

## Further Resources

- [Architecture Guide](./architecture.md)
- [API Documentation](./api.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [GitHub Repository](https://github.com/townhall/cli)