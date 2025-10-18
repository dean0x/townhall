# Townhall CLI Command Reference: Debate Simulation

## Overview
Townhall provides a Git-inspired CLI for agents to log structured actions during simulations. This reference focuses on debate simulations where agents make arguments, respond to each other, and build a traceable interaction history.

## Implementation Status

### ✅ Currently Implemented (Phase 1 MVP)

**Core Commands**:
- `init` - Initialize repository
- `simulate debate` - Create new debate simulation
- `checkout` - Switch to simulation context
- `status` - Show current simulation status
- `list` - List all simulations

**Debate Commands**:
- `argument` - Submit structured argument
- `rebuttal` - Respond to argument
- `concede` - Acknowledge valid point
- `vote` - Vote to close debate

**Query Commands**:
- `log` - View debate history
- `show` - Display argument details
- `trace` - Show argument chain

### 🔮 Planned Features (Future Releases)

The following commands are documented for future implementation:

**Agent Management**: `register`, `whoami`
**Analysis**: `positions`, `analyze`, `export`
**Data Management**: `archive`, `validate`
**Configuration**: `config`
**Evidence**: `citation` (standalone command)

These features represent the planned roadmap and are included in this documentation to show the complete vision for the CLI.

---

## Core Commands

### townhall init
Initialize a new Townhall repository
```bash
townhall init [directory]

# Examples
townhall init                    # Initialize in current directory
townhall init debates            # Create and initialize new directory

# Creates:
# .townhall/
#   ├── config
#   ├── HEAD
#   ├── simulations/
#   ├── agents/
#   └── index
```

### townhall simulate
Create a new simulation
```bash
townhall simulate <type> <name>

# Arguments
  type              Simulation type (debate, decision, brainstorm, etc.)
  name              Unique identifier for the simulation

# Examples
townhall simulate debate ai-regulation
townhall simulate debate climate-policy
townhall simulate debate tech-monopolies

# Output
Created simulation 'ai-regulation' (type: debate)
To enter this simulation, run: townhall checkout ai-regulation
```

### townhall checkout
Enter a simulation context
```bash
townhall checkout <simulation-name>

# Examples
townhall checkout ai-regulation

# Output
Switched to simulation 'ai-regulation' (type: debate)
Current stage: opening
Available commands: argument, citation, log, status

# After checkout, debate-specific commands become available
```

### townhall status
Show current context and available actions
```bash
townhall status

# When not in simulation
$ townhall status
Not in any simulation.
Available simulations:
  - ai-regulation (debate) - 15 arguments
  - climate-policy (debate) - 8 arguments

# When in simulation
$ townhall status
Simulation: ai-regulation (debate)
Stage: rebuttal
Your role: agent_proponent
Arguments made: 5
Last action: 2 minutes ago

Available commands:
  - argument: Make an argument
  - rebuttal: Respond to an argument
  - citation: Add evidence
  - concession: Acknowledge a point
```

### townhall list
List all simulations
```bash
townhall list [options]

# Options
  --type <type>     Filter by simulation type
  --active          Show only active simulations
  --archived        Show archived simulations

# Examples
townhall list
townhall list --type debate
townhall list --active

# Output
NAME              TYPE      STATUS    ACTIONS  CREATED
ai-regulation     debate    active    23       2024-01-15 10:00
climate-policy    debate    completed 45       2024-01-14 14:30
tech-monopolies   debate    active    12       2024-01-15 09:00
```

## Debate-Specific Commands

These commands are only available when checked out to a debate simulation.

### townhall argument
Make a structured argument
```bash
townhall argument [options] <content>

# Options
  --type <type>         Argument type (required)
                        deductive: Premise-based logic
                        inductive: Evidence generalization
                        empirical: Data-driven
                        analogical: Comparison-based
                        ethical: Value-based

  --opens               Opening argument (no prior response)
  --responds-to <id>    ID of argument being addressed
  --position <pos>      Your position (pro/con/neutral)
  --cites <sources>     Comma-separated citation IDs

# Examples

# Opening deductive argument
townhall argument --type deductive --opens --position pro \
  "Premise 1: Human rights must be protected.
   Premise 2: Unregulated AI can violate rights.
   Conclusion: Therefore, AI must be regulated."

# Inductive argument with evidence
townhall argument --type inductive --responds-to arg_001 \
  "Evidence from 50 tech companies shows:
   - 80% experienced data breaches
   - 60% had algorithmic bias issues
   Pattern: Lack of oversight leads to harm"

# Output
Created argument: arg_7f3a2b1c
Type: deductive
Position: pro
Stage: opening
```

### townhall rebuttal
Respond to an existing argument
```bash
townhall rebuttal [options] <content>

# Options
  --responds-to <id>    Target argument ID (required)
  --type <type>         Rebuttal type
                        logical: Challenge logic
                        empirical: Counter with data
                        methodological: Question method
                        contextual: Different context

  --cites <sources>     Supporting citations

# Examples

# Empirical rebuttal
townhall rebuttal --responds-to arg_001 --type empirical \
  --cites "Stanford-2023,MIT-2024" \
  "Your premise lacks support. Stanford study shows
   90% of AI systems operate safely without regulation."

# Logical rebuttal
townhall rebuttal --responds-to arg_002 --type logical \
  "Your conclusion doesn't follow. Correlation between
   regulation and safety isn't proven causation."

# Output
Created rebuttal: reb_9d4e5f2a
Responds to: arg_001
Type: empirical
Citations: 2 added
```

### townhall concession
Acknowledge a valid point
```bash
townhall concession [options] <content>

# Options
  --to <id>             Argument being conceded
  --partial             Partial concession only
  --condition <cond>    Conditional concession

# Examples

# Full concession
townhall concession --to arg_003 \
  "You're right that innovation has historically
   thrived with minimal regulation."

# Partial concession
townhall concession --to arg_004 --partial \
  "I agree that some flexibility is needed, but
   core safety standards remain essential."

# Output
Created concession: con_5b3c2a1f
To: arg_004
Type: partial
```

### townhall citation *(Planned Feature)*
Add evidence or references
```bash
townhall citation [options]

# Options
  --source <source>     Citation source (required)
  --type <type>         Source type (paper/article/report/data)
  --quote <text>        Relevant quote
  --page <page>         Page number
  --doi <doi>           Digital object identifier
  --url <url>           Web URL

# Examples

# Academic paper citation
townhall citation --source "MIT AI Safety Study 2023" \
  --type paper \
  --doi "10.1234/mit.ai.2023" \
  --quote "73% of unregulated AI systems show risk patterns" \
  --page 47

# Report citation
townhall citation --source "FCC Internet Growth Report" \
  --type report \
  --url "https://fcc.gov/reports/2001/growth" \
  --quote "Unregulated period saw 10000% growth"

# Output
Created citation: cit_3b2c1a4f
Source: MIT AI Safety Study 2023
Type: paper
Can be referenced with: @cit_3b2c1a4f
```

### townhall vote
Vote to close the current debate
```bash
townhall vote [options]

# Options
  --agent <uuid>        Agent UUID (required)
  --yes                 Vote to close the debate
  --no                  Vote against closing the debate
  --reason <text>       Optional reason for your vote

# Examples
# Vote to close
townhall vote --agent f05482e4-324d-4b50-8be3-a49f870cd968 --yes \
  --reason "All key points have been addressed"

# Vote against closing
townhall vote --agent a1b2c3d4-e5f6-7890-abcd-ef1234567890 --no \
  --reason "Still need to discuss implementation details"

# Output
✓ Vote cast successfully
Total votes: 2/3 needed
1 more vote(s) needed to close the debate

# When debate closes
✓ Vote cast successfully
Total votes: 3/3 needed

🎯 Debate closed!
All key points have been addressed
```

## Query Commands

### townhall log
View simulation history
```bash
townhall log [options]

# Options
  --graph               Show argument tree structure
  --author <agent>      Filter by agent
  --type <type>         Filter by argument type
  --stage <stage>       Filter by debate stage
  --oneline            Compact display
  -n <number>          Limit results

# Examples

# View argument graph
townhall log --graph
* arg_001 [agent_A] Opening: AI needs regulation
├── reb_002 [agent_B] Rebuttal: Innovation concerns
│   └── reb_004 [agent_A] Counter: Safety paramount
└── reb_003 [agent_C] Rebuttal: Market solutions
    └── con_005 [agent_A] Concession: Partial agreement

# View specific agent's arguments
townhall log --author agent_proponent --oneline
arg_001 Opening deductive argument for regulation
reb_004 Counter-rebuttal with MIT study citation
arg_008 Closing statement summarizing position
```

### townhall show
Display detailed information about an action
```bash
townhall show <id> [options]

# Options
  --responses          Show all responses
  --citations          Show citations used
  --full              Show complete content

# Examples
townhall show arg_001
Argument: arg_001
Agent: agent_proponent
Type: deductive
Stage: opening
Created: 2024-01-15 10:30:45

Content:
  Premise 1: Human rights must be protected
  Premise 2: Unregulated AI can violate rights
  Conclusion: AI must be regulated

Responses (2):
  - reb_002 by agent_opponent
  - reb_003 by agent_neutral

townhall show arg_001 --responses
[Shows full response tree]
```

### townhall trace
Trace argument lineage
```bash
townhall trace <id> [options]

# Options
  --upstream           Show what this responds to
  --downstream         Show all responses
  --depth <n>          Traversal depth limit

# Examples

# Trace upstream
townhall trace reb_004 --upstream
reb_004 responds to reb_002
  └── reb_002 responds to arg_001
      └── arg_001 (opening argument)

# Trace downstream
townhall trace arg_001 --downstream --depth 2
arg_001
├── reb_002
│   └── reb_004
└── reb_003
    └── con_005
```

### townhall positions *(Planned Feature)*
Analyze positions taken
```bash
townhall positions [options]

# Options
  --timeline           Show position evolution
  --summary           Summary statistics
  --by-agent          Group by agent

# Examples
townhall positions --summary
Position Summary:
  pro_regulation: 3 agents, 15 arguments
  anti_regulation: 2 agents, 10 arguments
  neutral: 1 agent, 3 arguments

Consensus: None (split decision)
```

## Analysis Commands *(Planned Features)*

### townhall analyze *(Planned Feature)*
Analyze debate patterns
```bash
townhall analyze [options]

# Options
  --metrics <metrics>  Comma-separated metrics
                      argument-types: Type distribution
                      response-time: Response patterns
                      citations: Citation analysis
                      participation: Agent activity

  --format <format>   Output format (text/json/csv)

# Examples

# Argument type analysis
townhall analyze --metrics argument-types
Argument Type Distribution:
  Deductive: 35% (8 arguments)
  Empirical: 30% (7 arguments)
  Inductive: 20% (5 arguments)
  Ethical: 15% (3 arguments)

# Participation analysis
townhall analyze --metrics participation
Agent Participation:
  agent_proponent: 8 arguments, 3 rebuttals, 2 citations
  agent_opponent: 6 arguments, 4 rebuttals, 1 concession
  agent_neutral: 3 arguments, 2 rebuttals
```

### townhall export *(Planned Feature)*
Export simulation data
```bash
townhall export [options] <output-file>

# Options
  --format <format>    Export format
                      json: Structured JSON
                      markdown: Human-readable report
                      csv: Tabular data
                      dot: GraphViz format

  --include <items>   What to include
                      arguments: All arguments
                      citations: All citations
                      relationships: Response graph
                      metadata: Simulation info

# Examples

# Export as markdown report
townhall export --format markdown debate-summary.md

# Export as JSON for analysis
townhall export --format json --include all data.json

# Export graph for visualization
townhall export --format dot graph.dot
dot -Tpng graph.dot -o debate-graph.png
```

## Agent Management *(Planned Features)*

### townhall register *(Planned Feature)*
Register as an agent
```bash
townhall register <agent-id> [options]

# Options
  --name <name>        Display name
  --role <role>        Agent role/perspective

# Examples
townhall register agent_ethicist \
  --name "Ethics Expert" \
  --role "Focus on moral implications"

# Output
Registered agent: agent_ethicist
You can now participate in simulations
```

### townhall whoami *(Planned Feature)*
Show current agent identity
```bash
townhall whoami

# Output
Agent ID: agent_proponent
Name: Regulation Advocate
Role: Argue for AI regulation
Active in: ai-regulation (debate)
Total arguments: 15
```

## Configuration *(Planned Features)*

### townhall config *(Planned Feature)*
Get and set configuration
```bash
townhall config [options] [key] [value]

# Options
  --list              List all settings
  --edit              Open in editor

# Examples

# Set default agent
townhall config agent.default agent_proponent

# Set argument format preferences
townhall config debate.argument.format structured

# List all settings
townhall config --list
agent.default = agent_proponent
debate.argument.format = structured
debate.citation.required = false
```

## Utility Commands *(Planned Features)*

### townhall validate *(Planned Feature)*
Validate simulation integrity
```bash
townhall validate [simulation]

# Examples
townhall validate ai-regulation

# Output
Validating simulation: ai-regulation
✓ All arguments have valid structure
✓ All responses reference existing arguments
✓ No circular references detected
✓ All citations are accessible
✓ Stage progression is valid

Simulation is valid.
```

### townhall archive *(Planned Feature)*
Archive completed simulation
```bash
townhall archive <simulation>

# Examples
townhall archive climate-policy

# Output
Archived simulation: climate-policy
Simulation is now read-only
Access with: townhall checkout climate-policy --read-only
```

### townhall help
Display help information
```bash
townhall help [command]

# Examples
townhall help
townhall help argument
townhall help rebuttal
```

## Environment Variables

### TOWNHALL_AGENT
Default agent identity
```bash
export TOWNHALL_AGENT=agent_proponent
```

### TOWNHALL_DIR
Override default `.townhall` directory
```bash
export TOWNHALL_DIR=/custom/path/.townhall
```

## Examples

### Complete Debate Flow

```bash
# Initialize and create debate
townhall init ai-debates
cd ai-debates
townhall simulate debate ai-regulation

# Agent A starts
townhall register agent_proponent --name "Pro Regulation"
townhall checkout ai-regulation

# Make opening argument
townhall argument --type deductive --opens --position pro \
  "P1: Human rights must be protected.
   P2: Unregulated AI can violate rights.
   C: Therefore, AI must be regulated."

# Agent B joins
townhall register agent_opponent --name "Anti Regulation"
townhall checkout ai-regulation

# Respond with rebuttal
townhall rebuttal --responds-to arg_001 --type empirical \
  "Innovation data contradicts this. See Internet growth."

# Add citation
townhall citation --source "Internet Growth Study 2000" \
  --type report --quote "Unregulated growth of 10000%"

# Continue debate...

# View final structure
townhall log --graph
townhall analyze --metrics all
townhall export --format markdown final-debate.md
```

### Query Examples

```bash
# Find all deductive arguments
townhall log --type deductive

# Show agent's contribution
townhall log --author agent_proponent --oneline

# Trace argument evolution
townhall trace reb_008 --upstream --depth 5

# Analyze citation usage
townhall citations --stats
```

## Error Messages

Common errors and their meanings:

```bash
ERROR: Not in a simulation context
# Solution: Use 'townhall checkout <simulation>' first

ERROR: Invalid argument type 'informal'
# Solution: Use valid types: deductive, inductive, empirical, analogical, ethical

ERROR: Referenced argument 'arg_999' not found
# Solution: Check argument ID with 'townhall log'

ERROR: Stage does not allow this action
# Solution: Check current stage with 'townhall status'
```

## Best Practices

1. **Always specify argument types** - This enables better analysis
2. **Link arguments properly** - Use --responds-to for clear relationships
3. **Add citations** - Support claims with evidence
4. **Use descriptive content** - Full arguments, not just summaries
5. **Check status regularly** - Know your simulation context
6. **Export periodically** - Save debate state for analysis