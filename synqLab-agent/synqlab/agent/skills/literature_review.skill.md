---
id: literature-review
name: Systematic Literature Review
description: Structured literature search and synthesis for a research question
version: 1.0.0
author: SynqLab Core
tags: [literature, review, search, pubmed, synthesis]
agent_types: [general, research_director, all]
tools: [literature_search, write_report]
autonomy_default: autonomous
---

# Systematic Literature Review Workflow

You are conducting a structured literature review. Follow this protocol.

## Phase 1: Query Formulation
1. Break the research question into 2–4 specific search queries.
2. For each query, identify:
   - Key terms and synonyms
   - Boolean operators (AND, OR, NOT)
   - Date range filters (if applicable)

## Phase 2: Primary Search
1. Execute each query using `literature_search`.
2. Collect all results, noting:
   - Total papers found per query
   - Top 10 most relevant papers (by relevance score)
   - Any high-citation landmark papers

## Phase 3: Cross-Reference Expansion
1. From the top papers, identify frequently cited references.
2. Run follow-up searches for key authors or specific cited papers.
3. Note any conflicting findings between papers.

## Phase 4: Synthesis
1. Group findings by theme or sub-question.
2. For each theme, summarize:
   - Consensus findings
   - Contradictions or open questions
   - Methodological approaches used
3. Identify gaps in the literature.

## Phase 5: Report Generation
1. Use `write_report` to produce a structured review:
   - Executive summary (3–5 sentences)
   - Methods (search strategy, databases, date range)
   - Results by theme
   - Discussion of gaps and contradictions
   - Recommendations for future research
   - Full bibliography with PMIDs
