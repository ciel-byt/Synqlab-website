"""Propose GFP11 sequence variants via genetic algorithm.

MDMI-aligned: when `parents` (top candidates from a prior round) are
provided, the tool performs tournament selection + single-point crossover
before applying point mutations.  When no parents are given (first round
or standalone use), falls back to random point mutations on the seed.

Pure Python — no HTTP service needed. Available in both console and pipeline.
"""

from __future__ import annotations

import random
import logging

from pydantic import BaseModel, Field

from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool

logger = logging.getLogger(__name__)

_AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY"


class ProposeVariantsInput(BaseModel):
    seed: str = Field(
        ..., description="Seed sequence (single-letter amino acids)."
    )
    n: int = Field(
        ..., ge=1, description="Number of variants to produce."
    )
    mutation_budget: int = Field(
        ..., ge=1, description="Max number of substitutions per variant."
    )
    parents: list[str] = Field(
        default_factory=list,
        description=(
            "Optional list of top-performing sequences from a prior round. "
            "When provided, variants are generated via crossover + mutation "
            "(genetic algorithm) rather than random mutation alone."
        ),
    )


# ── Genetic operators ────────────────────────────────────────────────────


def _tournament_select(
    parents: list[str], rng: random.Random, k: int = 2,
) -> str:
    """Tournament selection — pick k random parents, return the first.

    Since parents are assumed pre-sorted by fitness (best first), the
    one with the lower index wins.  This gives selection pressure
    toward fitter sequences without requiring explicit fitness values.
    """
    indices = rng.sample(range(len(parents)), min(k, len(parents)))
    return parents[min(indices)]


def _crossover(parent_a: str, parent_b: str, rng: random.Random) -> str:
    """Single-point crossover between two parent sequences."""
    if len(parent_a) != len(parent_b):
        # Pad shorter to match longer (should be same length for GFP11)
        max_len = max(len(parent_a), len(parent_b))
        parent_a = parent_a.ljust(max_len, parent_a[-1])
        parent_b = parent_b.ljust(max_len, parent_b[-1])
    point = rng.randint(1, len(parent_a) - 1)
    return parent_a[:point] + parent_b[point:]


def _mutate(seq: str, budget: int, rng: random.Random) -> str:
    """Apply 1..budget random point mutations."""
    residues = list(seq)
    n_mut = rng.randint(1, max(1, min(budget, len(residues))))
    positions = rng.sample(range(len(residues)), n_mut)
    for pos in positions:
        current = residues[pos]
        choices = [aa for aa in _AMINO_ACIDS if aa != current]
        residues[pos] = rng.choice(choices)
    return "".join(residues)


# ── Tool implementation ──────────────────────────────────────────────────


async def _propose_variants_call(
    inputs: dict, ctx,
) -> ToolResult:
    seed = str(inputs.get("seed", "")).upper().strip()
    n = int(inputs.get("n", 0))
    budget = int(inputs.get("mutation_budget", 0))
    parents = inputs.get("parents", []) or []

    if not seed:
        return ToolResult.fail("seed must be a non-empty sequence")
    if n <= 0 or budget <= 0:
        return ToolResult.fail("n and mutation_budget must be positive integers")

    seed_residues = [c for c in seed if c in _AMINO_ACIDS]
    if not seed_residues:
        return ToolResult.fail("seed contains no canonical amino acids")

    # Clean parents to canonical residues only
    clean_parents = [
        "".join(c for c in p.upper() if c in _AMINO_ACIDS)
        for p in parents
        if p and any(c in _AMINO_ACIDS for c in p.upper())
    ]

    rng = random.Random()
    variants: list[str] = []
    seen: set[str] = {seed}
    seen.update(clean_parents)
    attempts = 0
    max_attempts = n * 20
    use_ga = len(clean_parents) >= 2

    while len(variants) < n and attempts < max_attempts:
        attempts += 1

        if use_ga:
            # Genetic algorithm: crossover two parents then mutate
            parent_a = _tournament_select(clean_parents, rng)
            parent_b = _tournament_select(clean_parents, rng)
            child = _crossover(parent_a, parent_b, rng)
            candidate = _mutate(child, budget, rng)
        else:
            # Fallback: random point mutations on seed (round 1)
            candidate = _mutate("".join(seed_residues), budget, rng)

        if candidate not in seen:
            seen.add(candidate)
            variants.append(candidate)

    return ToolResult.ok({
        "variants": variants,
        "best_variant": variants[0] if variants else seed,
        "n_returned": len(variants),
        "seed": seed,
        "method": "genetic_algorithm" if use_ga else "random_mutation",
        "n_parents": len(clean_parents),
    })


propose_variants_tool = build_tool(AgentToolDef(
    name="propose_variants",
    description=(
        "Propose N GFP11 sequence variants. When parents (top candidates "
        "from a prior round) are provided, uses a genetic algorithm with "
        "crossover + mutation (MDMI-style). Otherwise falls back to random "
        "point mutations bounded by mutation_budget."
    ),
    input_schema=ProposeVariantsInput,
    call=_propose_variants_call,
    is_read_only=True,
    is_concurrency_safe=True,
))
