# Quickstart Guide: Townhall Debate Simulation

## Installation

```bash
# Install globally
npm install -g @townhall/cli

# Or run locally
npm install
npm link
```

## Quick Start

### 1. Initialize Townhall in your project

```bash
# Create a new Townhall repository
townhall init

# This creates:
# .townhall/
# ├── objects/     # Content-addressed storage
# ├── refs/        # References to simulations
# └── agents/      # Agent definitions
```

### 2. Create an Agent

```bash
# Create an agent definition
cat > .townhall/agents/socrates.md << EOF
---
id: 550e8400-e29b-41d4-a716-446655440001
name: Socrates
type: human
capabilities: [debate, analysis]
---
A classical philosopher focused on logical reasoning and the Socratic method.
EOF
```

### 3. Start a Debate

```bash
# Initialize a new debate simulation
townhall simulate debate "Should AI be regulated?"

# Output:
# ✓ Debate initialized: abc123def456...
# Topic: Should AI be regulated?
# Status: active
# Ready for arguments
```

### 4. Make an Argument

```bash
# Submit a deductive argument
townhall argument --agent socrates --type deductive \
  --premise "Unregulated technology can cause harm" \
  --premise "AI is a powerful technology" \
  --conclusion "AI should be regulated to prevent harm"

# Output:
# ✓ Argument created: def789abc123
# Agent: Socrates
# Type: Deductive
# ID: def789abc123... (short: def789a)
```

### 5. Submit a Rebuttal

```bash
# Another agent rebuts the argument
townhall rebuttal --agent aristotle --target def789a \
  --type empirical \
  --evidence "Historical data shows innovation thrives without regulation" \
  --claim "Regulation stifles AI innovation"

# Output:
# ✓ Rebuttal created: 789xyz456abc
# Responding to: def789a
# Agent: Aristotle
```

### 6. View Debate History

```bash
# See all arguments in chronological order
townhall log

# Output:
# Debate: Should AI be regulated? [active]
#
# 1. [def789a] Socrates (deductive) - 2025-01-26 10:00:00
#    "AI should be regulated to prevent harm"
#
# 2. [789xyz4] Aristotle (empirical) - 2025-01-26 10:05:00
#    ↳ rebuts: def789a
#    "Regulation stifles AI innovation"
```

### 7. View Relationships

```bash
# See argument relationships as a graph
townhall log --graph

# Output:
# def789a (Socrates: deductive)
# └── 789xyz4 (Aristotle: rebuttal)
```

### 8. Concede to an Argument

```bash
# Agent concedes to a point
townhall concede --agent socrates --target 789xyz4 \
  --type partial \
  --explanation "Valid concern about innovation impact"

# Output:
# ✓ Concession recorded: abc456def789
# Agent: Socrates
# Conceding to: 789xyz4 (partial)
```

### 9. Vote to Close

```bash
# Agents vote to close the debate
townhall vote-close --agent socrates --vote yes
townhall vote-close --agent aristotle --vote yes

# Output:
# ✓ Consensus reached - Debate closed
# Final argument count: 3
# Duration: 15 minutes
```

## Command Reference

### Core Commands

| Command | Description |
|---------|-------------|
| `townhall init` | Initialize Townhall repository |
| `townhall simulate debate <topic>` | Start new debate |
| `townhall argument` | Submit an argument |
| `townhall rebuttal` | Rebut an existing argument |
| `townhall concede` | Concede to an argument |
| `townhall log` | View debate history |
| `townhall vote-close` | Vote to close debate |

### Argument Types

**Deductive** (requires premises and conclusion):
```bash
townhall argument --type deductive \
  --premise "All humans are mortal" \
  --premise "Socrates is human" \
  --conclusion "Socrates is mortal"
```

**Inductive** (requires observations and generalization):
```bash
townhall argument --type inductive \
  --observation "Swan 1 is white" \
  --observation "Swan 2 is white" \
  --generalization "All swans are white"
```

**Empirical** (requires evidence and claim):
```bash
townhall argument --type empirical \
  --evidence "Study shows 90% improvement" \
  --claim "This method is effective"
```

## Testing the Installation

Run this test sequence to verify everything works:

```bash
# 1. Initialize
townhall init

# 2. Create test agent
echo '---
id: test-agent-001
name: TestAgent
type: llm
---' > .townhall/agents/test.md

# 3. Start debate
townhall simulate debate "Test topic"

# 4. Make argument
townhall argument --agent test-agent-001 --type deductive \
  --premise "A" --premise "B" --conclusion "C"

# 5. View log
townhall log

# If you see the argument in the log, installation is successful!
```

## Architecture Overview

```
Your Project/
├── .townhall/                 # Townhall repository
│   ├── objects/              # Content-addressed storage
│   │   ├── arguments/        # Argument objects
│   │   └── simulations/      # Simulation objects
│   ├── refs/                 # References
│   │   └── HEAD             # Current active simulation
│   └── agents/              # Agent MD files
└── [your project files]
```

## Common Workflows

### Multi-Agent Debate
```bash
# Agent 1 makes opening argument
townhall argument --agent alice --type deductive ...

# Agent 2 rebuts
townhall rebuttal --agent bob --target [hash] ...

# Agent 3 supports Agent 1
townhall argument --agent carol --supports [hash] ...

# View the debate structure
townhall log --graph
```

### Referencing Arguments
```bash
# Use full SHA
townhall rebuttal --target abc123def456789...

# Or short hash (first 7 chars)
townhall rebuttal --target abc123d
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No active debate" | Run `townhall simulate debate <topic>` first |
| "Agent not found" | Create agent MD file in `.townhall/agents/` |
| "Invalid argument structure" | Check type-specific requirements (premises, observations, evidence) |
| "Argument not found" | Verify argument ID with `townhall log` |

## Next Steps

- Explore advanced queries with `townhall query`
- Export debate data with `townhall export`
- Integrate with AI agents via MCP protocol
- Build custom analysis tools using the SDK