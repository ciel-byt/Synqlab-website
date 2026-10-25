# YC / Speedrun — v2 core answers (draft)

DRAFT. Supersedes the "operating system" story in `yc_questions.md` (kept for reference).
Every `[TODO]` needs a founder fact. Do not submit with TODOs.

---

## One-liner (≤50 chars)

Self-improving AI models for biology

**Description:** SynqLab turns a team's own data into a private model for their target, finds where it falls short, and fixes it. Customers host and own their models. Today an expert guides the diagnosis; we are automating it.

---

## What are you making?

A framework (Aria, for proteins and peptides) that customizes a model to a customer's task.

1. Customer brings a goal and data (public or private).
2. Framework tunes a model — from our base or theirs.
3. Candidates are generated and scored with oracles calibrated on the customer's labels.
4. The system finds weak spots and applies targeted fixes. Repeat.

Delivered as an app and an API. Customers host and own the weights. A small-molecule version (Lyra, working name) is planned on the same framework.

## What have you shown?

| Claim | Evidence | Status |
|---|---|---|
| Spec-following generation | Aria: Llama-3.1-8B tuned on ~350k Swiss-Prot proteins | Paper — NeurIPS 2026 [TODO: main track or workshop] |
| Improvement under feedback | +8.2 mean pLDDT on one family; +20.8 to +43.6 pts domain recovery on three more | In-silico; 4 protein families |
| Small labels calibrate a binding oracle | MDMI: ~100 labels, 4x more high-confidence binders vs RFdiffusion and PepMLM | Wet-lab, split-GFP, NeurIPS 2025 AI4D3 spotlight |
| Wet-lab data | 113 labeled GFP11 sequences | In hand |
| Transfer to unseen families | Addressed | Unpublished [TODO preprint] |

**Not yet shown:** the full loop on a real binding target; any benefit of an agent layer over a plain loop; customer pull.

## Why now

Generative models propose candidates and structure predictors filter them, but no loop learns from one team's results. Uncalibrated loops optimize the proxy, not biology (our ICBINB paper). Closed-loop learning on customer data is the open piece — Anthropic's 2026 autonomous design study was open-loop.

## Who needs it

Protein and peptide teams with small labeled datasets, who can't send data to closed APIs. [TODO: confirm with 5 interviews — this is a hypothesis.]
Collaborating labs at McMaster, UofT, University of Manitoba: [TODO what each provides].
## Competition

- **Cradle** — closest. Private per-customer models, customer owns sequences, enterprise license. We differ (to be tested): customer-hosted weights, natural-language specs, automated diagnosis.
- **Profluent, Latent Labs, EvolutionaryScale** — foundation models and agents; not tuned on a customer's own loop.
- **Tamarind** — tool marketplace.
- **Adaptyv, GenScript** — wet-lab providers; potential partners.

Details and sources: [`../market-research.md`](../market-research.md).

## Money

Hypothesis: subscription for the improvement loop (calibration, diagnosis, updates). Not compute, not weights. [TODO: pricing from interviews.] Drop the old top-down "10,000 labs × $20K" table.

**Ask:** the accelerator deals — YC $500K, a16z Speedrun up to $1M. (The old $5M and $10–20M figures are dropped.)

## Safety

[TODO: biosecurity statement — customer vetting, license terms, sequence screening and logging in the shipped runtime, hosted option. Say it reduces risk, not eliminates it.]

## Previous application

We applied before and were not accepted. What changed:
- [TODO: one concrete new result, e.g. benchmark number, design partner, interviews]
- Narrowed from "operating system" to one framework with a measurable claim.
- New evidence: Aria results, calibrated-oracle work.

The old draft says "First-time applicant" — wrong. Fix before submitting.

## Facts still needed

See "Open facts" in [`../STATUS.md`](../STATUS.md).
