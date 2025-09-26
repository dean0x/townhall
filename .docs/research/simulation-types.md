# Core Simulation Types and Patterns

This document outlines the various simulation types and patterns that can be implemented in the agent simulation engine.

## Simulation Types

### 1. **Debate**
- **Structure**: Opening positions → Rebuttals → Closing statements
- **Agents**: 2-5 with opposing viewpoints
- **Rounds**: Typically 3-5
- **Output**: Consensus score, key arguments, winning position
- **Example**: "Microservices vs Monolith architecture"

### 2. **Decision Making**
- **Structure**: Problem statement → Option evaluation → Risk assessment → Recommendation
- **Agents**: 3-8 representing different stakeholders/expertise
- **Rounds**: 2-4 (explore → evaluate → decide)
- **Output**: Decision matrix, recommended action, risk analysis
- **Example**: "Should we migrate to Kubernetes?"

### 3. **Negotiation**
- **Structure**: Initial positions → Offers/counter-offers → Compromise → Agreement
- **Agents**: 2-4 parties with different goals
- **Rounds**: Variable (until agreement or deadlock)
- **Output**: Final agreement terms, compromises made, deal score
- **Example**: "API contract negotiation between teams"

### 4. **Brainstorming**
- **Structure**: Parallel idea generation → Clustering → Refinement
- **Agents**: 4-10 with diverse perspectives
- **Rounds**: 1-2 (generate → refine)
- **Output**: Idea list, themes, top recommendations
- **Example**: "Generate solutions for reducing system latency"

### 5. **Review/Critique**
- **Structure**: Present artifact → Multi-angle analysis → Synthesis
- **Agents**: 3-6 specialized reviewers
- **Rounds**: 1 (parallel review)
- **Output**: Issues found, improvement suggestions, quality scores
- **Example**: "Architecture design review"

### 6. **Scenario Planning**
- **Structure**: Base case → Multiple futures → Impact analysis
- **Agents**: 3-5 exploring different scenarios
- **Rounds**: Parallel exploration
- **Output**: Scenario comparison, probability assessment, contingency plans
- **Example**: "What if our traffic grows 10x?"

### 7. **Consensus Building**
- **Structure**: Individual positions → Find common ground → Build agreement
- **Agents**: 3-8 with initially different views
- **Rounds**: 3-4 (state → discuss → converge)
- **Output**: Consensus level, agreed points, remaining disagreements
- **Example**: "Agree on coding standards for the team"

### 8. **Competition/Tournament**
- **Structure**: Head-to-head comparisons → Elimination/ranking
- **Agents**: 4+ competing solutions
- **Rounds**: Log(n) for elimination, n-1 for round-robin
- **Output**: Winner, rankings, comparative analysis
- **Example**: "Best algorithm for the problem"

### 9. **Root Cause Analysis**
- **Structure**: Problem statement → Multiple hypotheses → Evidence gathering → Conclusion
- **Agents**: 3-5 investigators with different expertise
- **Rounds**: 2-3 (hypothesize → investigate → conclude)
- **Output**: Root cause(s), contributing factors, remediation plan
- **Example**: "Why did the system crash?"

### 10. **Trade-off Analysis**
- **Structure**: Define axes → Position options → Evaluate trade-offs
- **Agents**: 2-4 representing different priorities
- **Rounds**: 2 (evaluate → reconcile)
- **Output**: Trade-off matrix, optimal balance point, justification
- **Example**: "Performance vs security vs cost"

### 11. **Advisory Panel**
- **Structure**: Present situation → Expert opinions → Synthesized recommendation
- **Agents**: 3-6 domain experts
- **Rounds**: 1-2 (advise → clarify)
- **Output**: Expert recommendations, confidence levels, action plan
- **Example**: "How to scale our database architecture"

### 12. **Devils Advocate**
- **Structure**: Proposal → Systematic challenge → Defense → Refined proposal
- **Agents**: 1 proposer, 2-3 challengers
- **Rounds**: 2-3 (propose → challenge → refine)
- **Output**: Strengthened proposal, identified weaknesses, mitigations
- **Example**: "Stress-test our disaster recovery plan"

### 13. **Perspective Taking**
- **Structure**: Same problem → Different lenses → Combined view
- **Agents**: 4-6 with distinct viewpoints
- **Rounds**: 1 (parallel analysis)
- **Output**: Multi-dimensional analysis, blind spots revealed, holistic view
- **Example**: "Evaluate this code from security, performance, and maintainability views"

### 14. **Forecasting**
- **Structure**: Current state → Projections → Confidence assessment
- **Agents**: 3-5 with different models/approaches
- **Rounds**: 1-2 (project → reconcile)
- **Output**: Range of forecasts, confidence intervals, key assumptions
- **Example**: "Predict system load for next quarter"

### 15. **Retrospective**
- **Structure**: What happened → Why → Lessons learned → Action items
- **Agents**: 3-6 participants with different roles
- **Rounds**: 3 (facts → analysis → planning)
- **Output**: Timeline, lessons learned, improvement actions
- **Example**: "Project post-mortem analysis"

## Common Patterns Across Types

### Interaction Patterns
- **Sequential**: Agents respond one after another, seeing previous responses
- **Parallel**: All agents respond simultaneously without seeing others
- **Iterative**: Multiple rounds with evolving positions
- **Hierarchical**: Some agents synthesize others' outputs

### Consensus Mechanisms
- **Voting**: Simple majority or weighted votes
- **Scoring**: Numerical ratings averaged
- **Argumentation**: Strength of arguments evaluated
- **Synthesis**: Moderator agent combines views

### Output Formats
- **Decision**: Clear recommended action
- **Analysis**: Multi-faceted evaluation
- **Ranking**: Ordered list of options
- **Report**: Comprehensive findings document

## Implementation Considerations

### For Claude Code Integration
Each simulation type can be implemented using Claude Code's Task tool with:
- Up to 10 parallel sub-agents per round
- Independent context windows for each agent
- Technical/code-focused framing for best results
- Stateless operation (no memory between Task invocations)

### Agent Configuration
Agents for each simulation type should be defined with:
- Clear role/expertise description
- Specific evaluation criteria
- Response format guidelines
- Technical perspective framing

### Data Structure
Each simulation should track:
- Simulation type and configuration
- Agent definitions and prompts
- Round-by-round responses
- Final synthesis and analysis
- Metadata (timestamps, duration, token usage)