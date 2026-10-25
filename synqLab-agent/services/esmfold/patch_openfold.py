"""Patch openfold for CPU-only inference (also works with GPU).

Finds ALL occurrences of importlib.import_module("attn_core_inplace_cuda")
across the openfold codebase and wraps them in try/except.
Also replaces attention_core.py with a CPU-compatible stub.
"""
import pathlib
import subprocess

OPENFOLD = pathlib.Path("/opt/openfold/openfold")

# ── 1. Replace attention_core.py with CPU+GPU compatible version ──
attn = OPENFOLD / "utils" / "kernel" / "attention_core.py"
attn.write_text('''\
import importlib
import math
import torch

# Try loading the compiled CUDA kernel; fall back to pure-PyTorch on CPU
try:
    attn_core_inplace_cuda = importlib.import_module("attn_core_inplace_cuda")
except (ImportError, ModuleNotFoundError):
    attn_core_inplace_cuda = None


def attention_core(q, k, v, bias=None, inf=1e9):
    """Pure-PyTorch attention fallback (used when CUDA kernel unavailable)."""
    if attn_core_inplace_cuda is not None:
        return attn_core_inplace_cuda.forward(q, k, v, bias, inf)

    scale = 1.0 / math.sqrt(q.shape[-1])
    attn_weights = torch.matmul(q * scale, k.transpose(-2, -1))
    if bias is not None:
        attn_weights = attn_weights + bias
    attn_weights = torch.softmax(attn_weights, dim=-1)
    return torch.matmul(attn_weights, v)
''')
print("✓ Patched attention_core.py")

# ── 2. Patch ALL .py files that have bare importlib.import_module("attn_core_inplace_cuda") ──
CUDA_IMPORT = 'attn_core_inplace_cuda = importlib.import_module("attn_core_inplace_cuda")'
SAFE_IMPORT = """try:
    attn_core_inplace_cuda = importlib.import_module("attn_core_inplace_cuda")
except (ImportError, ModuleNotFoundError):
    attn_core_inplace_cuda = None"""

patched = 0
for pyfile in OPENFOLD.rglob("*.py"):
    if pyfile == attn:
        continue  # already replaced above
    src = pyfile.read_text()
    if CUDA_IMPORT in src:
        pyfile.write_text(src.replace(CUDA_IMPORT, SAFE_IMPORT))
        print(f"✓ Patched {pyfile.relative_to(OPENFOLD.parent)}")
        patched += 1

print(f"  ({patched} additional files patched)")

# ── 3. Patch seed.py to remove pytorch_lightning dependency ──────
# openfold's seed.py imports pytorch_lightning.utilities.seed which
# is version-dependent and unnecessary for inference-only mode.
seed_py = OPENFOLD / "utils" / "seed.py"
seed_py.write_text('''\
import os
import logging
import random
import numpy as np


def seed_globally(seed=None):
    """Simplified seeding — no pytorch_lightning dependency."""
    if "PL_GLOBAL_SEED" not in os.environ:
        if seed is None:
            seed = random.randint(0, np.iinfo(np.uint32).max)
        os.environ["PL_GLOBAL_SEED"] = str(seed)
        logging.info(f'os.environ["PL_GLOBAL_SEED"] set to {seed}')
    random.seed(seed)
    np.random.seed(seed)
''')
print("✓ Patched seed.py (removed pytorch_lightning dep)")

# ── 4. Clear all __pycache__ ─────────────────────────────────────
subprocess.run(
    ["find", str(OPENFOLD), "-type", "d", "-name", "__pycache__", "-exec", "rm", "-rf", "{}", "+"],
    capture_output=True, text=True
)
print("✓ Cleared __pycache__")

print("\\n✓ All patches applied")

