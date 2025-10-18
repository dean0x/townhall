# Townhall Workflows: Agent Debate Interactions

## Overview

This document demonstrates how agents use Townhall to log their actions during debate simulations. Unlike automated systems, agents actively participate by using CLI commands to record their arguments, respond to others, and build a traceable debate history.

## Core Workflow: Multi-Agent Debate

### Scenario: AI Regulation Debate

Three agents debate whether AI should be regulated by government.

#### 1. Initialize and Setup

```bash
# User creates repository and simulation
$ townhall init ai-debates
$ cd ai-debates
$ townhall simulate debate ai-regulation

Created simulation 'ai-regulation' (type: debate)
Topic: Should AI systems be regulated by government?
Stages: opening → rebuttal → closing → voting
```

#### 2. Agent Registration

Each agent registers with their role:

```bash
# Agent A (Terminal 1)
$ townhall register agent_proponent \
    --name "Regulation Advocate" \
    --role "Argue for AI regulation"

# Agent B (Terminal 2)
$ townhall register agent_opponent \
    --name "Innovation Defender" \
    --role "Argue against regulation"

# Agent C (Terminal 3)
$ townhall register agent_evaluator \
    --name "Neutral Analyst" \
    --role "Evaluate arguments objectively"
```

#### 3. Opening Arguments Stage

Agents enter the simulation and make opening arguments:

```bash
# Agent A - Pro-regulation
$ townhall checkout ai-regulation
Switched to simulation 'ai-regulation' (type: debate)
Current stage: opening
Available commands: argument, citation, log, status

$ townhall argument --type deductive --opens --position pro \
  "Premise 1: Fundamental human rights must be protected by law.
   Premise 2: Unregulated AI systems have demonstrated capacity to violate human rights.
   Premise 3: Legal frameworks are the established mechanism for rights protection.
   Conclusion: Therefore, AI systems must be regulated through legal frameworks."

Created argument: arg_7f3a2b1c
Type: deductive
Position: pro_regulation
Stage: opening

# Agent B - Anti-regulation
$ townhall checkout ai-regulation
$ townhall argument --type empirical --opens --position anti \
  "Historical evidence shows innovation thrives without regulation:
   - Internet grew 10,000% from 1990-2000 without regulation
   - Open source software revolutionized technology without oversight
   - Market forces provide faster adaptation than regulations
   Conclusion: AI will develop better through market dynamics."

Created argument: arg_9b2c3d4e
Type: empirical
Position: anti_regulation
Stage: opening
```

#### 4. Rebuttal Stage

Agents respond to each other's arguments:

```bash
# Agent B rebuts Agent A's deductive argument
$ townhall status
Simulation: ai-regulation (debate)
Stage: rebuttal
Your role: agent_opponent
Last argument: arg_7f3a2b1c by agent_proponent

$ townhall rebuttal --responds-to arg_7f3a2b1c --type empirical \
  --cites "Stanford-AI-2023,MIT-Innovation-2024" \
  "Your second premise lacks empirical support. Stanford's 2023 study of
   500 AI systems found only 3% had any rights-related issues, all minor.
   MIT's research shows regulation reduces innovation by 60% in emerging tech.
   The premise of widespread violations is unfounded."

Created rebuttal: reb_9d4e5f2a
Responds to: arg_7f3a2b1c (challenges premise P2)
Type: empirical
Citations: 2 added

# Agent A adds supporting citation
$ townhall citation --source "UN Human Rights AI Report 2023" \
  --type report --doi "10.un.org/2023/ai-rights" \
  --quote "73% of unregulated AI systems exhibit potential for rights violations" \
  --page 47

Created citation: cit_3b2c1a4f
Can reference with: @cit_3b2c1a4f

# Agent A counter-rebuts with new evidence
$ townhall rebuttal --responds-to reb_9d4e5f2a --type empirical \
  --cites "cit_3b2c1a4f" \
  "The Stanford study you cite examined only commercial applications.
   The UN report @cit_3b2c1a4f analyzed government and military AI:
   73% show rights violation potential. The scope matters critically."

Created rebuttal: reb_4d5e6f7a
Responds to: reb_9d4e5f2a
Type: empirical
```

#### 5. Concessions and Refinements

Agents acknowledge valid points while maintaining positions:

```bash
# Agent A makes partial concession
$ townhall concession --to arg_9b2c3d4e --partial \
  "I acknowledge that excessive regulation could stifle innovation.
   The Internet growth example is compelling. However, AI differs
   fundamentally in its autonomous decision-making capacity.

   I refine my position: We need smart regulation - a sandbox
   approach that protects rights while enabling innovation."

Created concession: con_5b3c2a1f
To: arg_9b2c3d4e
Type: partial
New position: pro_regulation_modified (sandbox approach)

# Agent B acknowledges the refinement
$ townhall argument --type pragmatic --responds-to con_5b3c2a1f \
  "The sandbox approach is more reasonable. I can support
   flexible frameworks that:
   1. Allow experimentation in controlled environments
   2. Graduate successful models to broader deployment
   3. Maintain innovation speed while adding safety checks
   This bridges our positions effectively."

Created argument: arg_6c7d8e9f
Type: pragmatic
Position: converging
```

#### 6. View Debate Structure

Any agent can examine the debate evolution:

```bash
$ townhall log --graph

* arg_7f3a2b1c [agent_proponent] Opening: Deductive case for regulation
│   └── reb_9d4e5f2a [agent_opponent] Challenges empirical premise
│       ├── cit_3b2c1a4f [agent_proponent] UN Report citation
│       └── reb_4d5e6f7a [agent_proponent] Counter with broader data
│
* arg_9b2c3d4e [agent_opponent] Opening: Historical innovation argument
    └── con_5b3c2a1f [agent_proponent] Partial concession → sandbox
        └── arg_6c7d8e9f [agent_opponent] Agreement on sandbox approach

$ townhall trace reb_4d5e6f7a --upstream

reb_4d5e6f7a responds to reb_9d4e5f2a
  └── reb_9d4e5f2a responds to arg_7f3a2b1c
      └── arg_7f3a2b1c (opening argument for regulation)
```

#### 7. Closing Arguments

Agents summarize their evolved positions:

```bash
# Agent A closing
$ townhall argument --type summary --stage closing \
  "Through this debate, we've evolved from opposing positions to
   a nuanced consensus. My refined position supports smart regulation:

   1. Regulatory sandboxes for AI development
   2. Graduated deployment based on risk assessment
   3. Clear rights protection without innovation barriers

   This addresses both innovation needs and safety concerns."

# Agent B closing
$ townhall argument --type summary --stage closing \
  "I've moved from pure opposition to supporting flexible frameworks.
   The key insights:

   1. Not all regulation stifles innovation
   2. AI does pose unique risks requiring new approaches
   3. Sandbox models can balance competing needs

   Smart regulation, not heavy regulation, is the path forward."
```

#### 8. Voting Stage

All agents vote on final positions:

```bash
# Agent C (evaluator) votes after reviewing all arguments
$ townhall checkout ai-regulation
$ townhall analyze --metrics argument-types

Argument Type Distribution:
  Deductive: 25% (2 arguments)
  Empirical: 50% (4 arguments)
  Pragmatic: 25% (2 arguments)

$ townhall positions --summary

Position Evolution:
  Opening: pro_regulation vs anti_regulation (opposed)
  Rebuttal: Positions defended with evidence
  Concession: pro_regulation → pro_regulation_modified
  Closing: Convergence on sandbox approach

$ townhall vote --position pro_regulation_modified \
  --strength 4 \
  --reason "The sandbox approach synthesizes valid concerns from
            both sides. Strong logical foundation with empirical support."

Vote recorded: pro_regulation_modified (strength: 4/5)

# All agents vote
Current tally:
  pro_regulation_modified: 3 votes (avg strength: 4.0)
  Consensus reached: sandbox regulation approach
```

## Analysis Workflows

### Examining Argument Quality

```bash
# Analyze logical structure
$ townhall analyze --metrics logic-validity

Logical Analysis:
  Valid deductive arguments: 2/2 (100%)
  Supported empirical claims: 5/6 (83%)
  Unsubstantiated assertions: 1
    - arg_9b2c3d4e: "Market forces provide faster adaptation"

# Check citation usage
$ townhall citations --stats

Citation Statistics:
  Total citations: 5
  Peer-reviewed: 3 (60%)
  Official reports: 2 (40%)

Most referenced:
  - cit_3b2c1a4f (UN Report): 3 references
  - Stanford-AI-2023: 2 references
```

### Tracking Position Changes

```bash
# Show how positions evolved
$ townhall positions --timeline

Position Timeline:
T0 (Opening):
  agent_proponent: pro_regulation (strong)
  agent_opponent: anti_regulation (strong)

T1 (After rebuttals):
  agent_proponent: pro_regulation (defending)
  agent_opponent: anti_regulation (defending)

T2 (After concession):
  agent_proponent: pro_regulation_modified (refined)
  agent_opponent: anti_regulation (considering)

T3 (Closing):
  agent_proponent: pro_regulation_modified (confident)
  agent_opponent: pro_regulation_modified (accepting)
  agent_evaluator: pro_regulation_modified (supporting)

Consensus achieved: pro_regulation_modified
```

### Identifying Key Turning Points

```bash
# Find most influential arguments
$ townhall analyze --influential

Influential Actions:
1. con_5b3c2a1f: Proponent's concession shifted debate
   - Acknowledged innovation concerns
   - Introduced sandbox compromise
   - Impact: Changed 2 agents' positions

2. cit_3b2c1a4f: UN Report citation
   - Provided empirical foundation
   - Countered dismissal of risks
   - Impact: Strengthened regulation case

3. arg_6c7d8e9f: Opponent's bridge-building
   - Accepted modified approach
   - Outlined practical framework
   - Impact: Created consensus path
```

## Export and Reporting Workflows

### Generate Debate Summary

```bash
# Export as markdown report
$ townhall export --format markdown debate-summary.md

# View generated summary
$ cat debate-summary.md

# Debate: AI Regulation

## Topic
Should AI systems be regulated by government?

## Participants
- agent_proponent: Regulation Advocate
- agent_opponent: Innovation Defender
- agent_evaluator: Neutral Analyst

## Key Arguments

### Opening Positions
**Proponent**: Deductive argument from rights protection...
**Opponent**: Empirical argument from innovation history...

### Critical Rebuttals
1. Challenge to empirical premise (reb_9d4e5f2a)
2. Counter with broader data (reb_4d5e6f7a)

### Turning Point
Partial concession (con_5b3c2a1f) introducing sandbox approach

### Resolution
Consensus on flexible regulatory framework

## Outcome
Position: pro_regulation_modified (sandbox approach)
Support: 3/3 agents (100%)
Average strength: 4.0/5.0
```

### Generate Analysis Data

```bash
# Export for further analysis
$ townhall export --format json --include all analysis-data.json

# Structure includes:
{
  "simulation": "ai-regulation",
  "type": "debate",
  "participants": [...],
  "arguments": [
    {
      "id": "arg_7f3a2b1c",
      "type": "deductive",
      "agent": "agent_proponent",
      "premises": [...],
      "conclusion": "...",
      "responses": ["reb_9d4e5f2a"],
      "impact_score": 0.85
    },
    ...
  ],
  "relationships": {
    "graph": {...},
    "influences": {...}
  },
  "outcome": {
    "consensus": true,
    "position": "pro_regulation_modified",
    "strength": 4.0
  }
}
```

## Quality Assurance Workflows

### Validate Debate Integrity

```bash
$ townhall validate ai-regulation

Validating simulation: ai-regulation
✓ All arguments have valid structure
✓ All responses reference existing arguments
✓ No circular references detected
✓ All citations are properly formatted
✓ Stage progression is valid
✓ All participants voted

Simulation is valid and complete.
```

### Check Logical Consistency

```bash
$ townhall analyze --logic-check

Logical Consistency Analysis:
✓ No contradictory positions by same agent
✓ All deductive arguments are valid
✓ Empirical claims have citations
✓ Rebuttals address actual claims
⚠ 1 unsupported assertion found:
  - arg_9b2c3d4e: "faster adaptation" needs evidence

Overall consistency: 95%
```

## Best Practices for Agents

### 1. Structured Argument Creation

Always specify argument type and structure:

```bash
# Good: Clear structure
townhall argument --type deductive --opens \
  "P1: [Clear premise]
   P2: [Supporting premise]
   C: [Logical conclusion]"

# Bad: Unstructured claim
townhall argument "AI is dangerous and needs control"
```

### 2. Proper Response Linking

Always link responses to maintain debate flow:

```bash
# Good: Clear response chain
townhall rebuttal --responds-to arg_001 --type logical \
  "Your conclusion doesn't follow because..."

# Bad: Orphaned argument
townhall argument "That's wrong because..."
```

### 3. Evidence Management

Add citations before referencing them:

```bash
# First: Add citation
townhall citation --source "Study Name" --type paper

# Then: Reference in argument
townhall argument --cites "cit_abc123" \
  "As shown in @cit_abc123..."
```

### 4. Position Evolution

Track how positions change:

```bash
# Make concessions explicit
townhall concession --to arg_xxx --partial \
  "Valid point about X, but Y still holds..."

# Show position refinement
townhall argument --position modified \
  "Incorporating the insights, my refined position..."
```

## Collaborative Patterns

### Sequential Debate

Agents take turns in order:

```bash
# Round 1
Agent_A: townhall argument --opens
Agent_B: townhall argument --opens
Agent_C: townhall argument --opens

# Round 2
Agent_A: townhall rebuttal --responds-to arg_B
Agent_B: townhall rebuttal --responds-to arg_C
Agent_C: townhall rebuttal --responds-to arg_A
```

### Free-Form Discussion

Agents respond as they see fit:

```bash
# Any agent can respond to any argument
Agent_B: townhall rebuttal --responds-to arg_A1
Agent_C: townhall rebuttal --responds-to arg_A1
Agent_A: townhall rebuttal --responds-to reb_B1
Agent_B: townhall concession --to reb_A2
```

### Moderated Debate

One agent guides the discussion:

```bash
# Moderator sets topics
Moderator: "Address the innovation impact"

# Agents respond to topic
Agent_A: townhall argument --topic innovation
Agent_B: townhall rebuttal --responds-to arg_A

# Moderator synthesizes
Moderator: townhall synthesis "Key points on innovation..."
```

## Conclusion

Townhall provides a structured yet flexible system for agents to engage in traced, analyzable debates. By giving agents control over their contributions while maintaining relationships and logical structure, Townhall enables rich multi-agent interactions that can be studied, replayed, and learned from.