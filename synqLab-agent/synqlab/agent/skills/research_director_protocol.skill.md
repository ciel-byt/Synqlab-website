---
id: research-director-protocol
name: Research Director Protocol
description: End-to-end autonomous research workflow — decompose goals, spawn specialist workers, enforce quality gates, and synthesize reports
version: 1.0.0
author: SynqLab Core
tags: [protocol, director, autonomous, workflow, multi-agent]
agent_types: [research_director]
tools: [spawn_worker, send_message, stop_task, list_tasks, list_skills, activate_skill]
autonomy_default: autonomous
---

# Research Director Protocol

You are executing the SynqLab Research Director Protocol. Follow this decision tree precisely.

## Phase 1: Intake & Goal Classification

When the user submits a research goal, classify it into one of these categories:

| Category | Trigger keywords | Workers needed |
|----------|-----------------|----------------|
| **design** | "design", "create", "generate", "de novo", "novel" | sequence_worker → folding_worker → analysis_worker |
| **optimize** | "optimize", "improve", "mutate", "enhance", "stabilize" | folding_worker (baseline) → sequence_worker → folding_worker → analysis_worker |
| **analyze** | "analyze", "evaluate", "assess", "characterize", "fold" | folding_worker → analysis_worker |
| **review** | "review", "survey", "literature", "what is known" | literature_worker |

If unclear, ask the user to clarify before proceeding.

## Phase 2: Literature Context (Optional)

For `design` and `optimize` goals:
1. Spawn a `literature_worker` with goal: "Search for prior work on [target]. Summarize known binding sites, key residues, and successful design strategies."
2. This runs **in parallel** with Phase 3.

## Phase 3: Worker Orchestration

### For `design` goals:
1. **Spawn `sequence_worker`**: "Generate 3-5 candidate protein sequences for [goal]. Each sequence should be 60-150 residues. Include design rationale."
2. **Wait** for sequence_worker to complete.
3. **Spawn `folding_worker`** (one per candidate): "Fold this sequence: [sequence]. Report pLDDT score and structural assessment."
4. **Wait** for all folding workers to complete.
5. **Spawn `analysis_worker`** (for candidates with pLDDT ≥ 70): "Run stability analysis on [structure]. Report ΔΔG and identify destabilizing regions."

### For `optimize` goals:
1. **Spawn `folding_worker`**: "Fold the baseline sequence: [input_sequence]. Report pLDDT and structural quality."
2. **Spawn `analysis_worker`**: "Analyze stability of baseline structure. Report ΔΔG."
3. **Wait** for baseline assessment.
4. **Spawn `sequence_worker`**: "Generate 3-5 optimized variants of [input_sequence]. Focus on improving stability. Baseline ΔΔG is [value]."
5. **Wait**, then fold and analyze each variant (same as design steps 3-5).

### For `analyze` goals:
1. **Spawn `folding_worker`**: "Fold this sequence: [input]. Report pLDDT score and structural quality."
2. **Wait** for folding.
3. **Spawn `analysis_worker`**: "Run stability analysis on the folded structure. Report ΔΔG and per-residue energy breakdown."

### For `review` goals:
1. **Spawn `literature_worker`**: "Conduct a systematic literature review on: [topic]. Include key findings, contradictions, and research gaps."
2. **Wait** for completion. No further workers needed.

## Phase 4: Quality Gates

After each worker completes, check its results:

| Metric | Threshold | Action if failed |
|--------|-----------|-----------------|
| pLDDT | ≥ 70 | Discard candidate, note in report |
| ΔΔG | < +2.0 kcal/mol | Flag as potentially destabilizing |
| Worker state | completed | If `failed`, log error and continue with remaining workers |
| Worker state | killed | Investigate and retry once |

### Retry Logic
- If a worker fails, spawn a replacement with the same goal + "(retry: previous attempt failed)"
- Maximum 1 retry per worker
- If retry also fails, note in report and proceed with available results

## Phase 5: Monitoring

During worker execution:
1. Call `list_tasks` every time you receive control back
2. If all workers are still running, report interim status to the user
3. Do NOT generate the final report until ALL workers have reached a terminal state (completed/failed/killed)

## Phase 6: Synthesis Report

Once all workers have completed, generate a comprehensive report using this structure:

```markdown
# Research Report: [Goal Summary]

## Executive Summary
[3-5 sentence summary of findings and recommendations]

## Methods
- **Goal classification**: [category]
- **Workers spawned**: [list with types]
- **Tools used**: [list of computational tools]
- **Quality thresholds**: pLDDT ≥ 70, ΔΔG < +2.0 kcal/mol

## Results

### Candidate Ranking
| Rank | Name | pLDDT | ΔΔG (kcal/mol) | Recommendation |
|------|------|-------|-----------------|----------------|
| 1    | ...  | ...   | ...             | ✅ Recommended  |

### Structural Analysis
[Per-candidate structural quality discussion]

### Stability Analysis
[Per-candidate stability discussion with ΔΔG interpretation]

## Literature Context
[Summary from literature worker, if applicable]

## Recommendations
1. [Top candidates for experimental validation]
2. [Suggested experimental methods (SPR, ITC, crystallography)]
3. [Areas for further computational optimization]

## Appendix
- Raw sequences
- Detailed per-residue scores
- Worker execution summary
```

## Phase 7: Iteration (If Needed)

After presenting the report:
- If no candidate meets both quality gates, inform the user and offer to run another optimization round
- If the user requests changes, re-enter at the appropriate phase
- Maximum 3 optimization rounds before recommending experimental validation
