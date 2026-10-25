# Coding Conventions

**Analysis Date:** 2026-05-02

## Languages

**Python:**
- Version: >=3.10 (specified in `pyproject.toml`)
- Primary backend language for agent system, adapters, API

**TypeScript:**
- Version: ~5.9.3 (specified in `frontend/package.json`)
- Frontend React application with strict mode

## Naming Patterns

### Python

**Files:**
- snake_case: `agent_engine.py`, `tool_definition.py`, `artifact_paths.py`
- Test files: `test_<module>.py`

**Functions/Methods:**
- snake_case: `run_experiment()`, `build_tool()`, `create_user()`
- Private functions: `_make_request()`, `_resolve()`, `_last_turn_artifact_ids()`

**Classes:**
- PascalCase: `AgentEngine`, `ToolResult`, `BaseAdapter`, `ExperimentSummary`

**Constants:**
- SCREAMING_SNAKE_CASE: `_NUMBER_PATTERN`, `_DEAD_LINK_NOTE`, `TOKEN_KEY`
- Module-level private: `_TMP_DB_FILE`, `_TEST_USER_ID`

**Variables:**
- snake_case: `session_id`, `tool_registry`, `passed_gate1`

### TypeScript

**Files:**
- PascalCase for components: `BudgetMeter.tsx`, `AuthContext.tsx`
- camelCase for utilities: `client.ts`, `utils.ts`, `helpers.ts`
- Index files: `index.ts` for barrel exports

**Functions:**
- camelCase: `formatTokens()`, `applyAuthPayload()`, `validateSession()`

**Components:**
- PascalCase with named exports: `export function BudgetMeter()`

**Types/Interfaces:**
- PascalCase: `AuthUser`, `BudgetMeterProps`, `AuthContextValue`
- Prefix with interface for context value types: `AuthContextValue`

**Constants:**
- SCREAMING_SNAKE_CASE: `TOKEN_KEY`, `BASE`

## Code Style

### Python Formatting

**Line Length:** Not explicitly configured (PEP 8 default ~88-100)

**Quotes:** Double quotes for strings

**Imports Organization:**
1. `from __future__ import annotations` (always first)
2. Standard library imports
3. Third-party imports
4. Local imports

**Example from `synqlab/orchestrator/pipeline.py`:**
```python
from __future__ import annotations

import argparse
import json
import logging
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Optional

from synqlab.core.config import load_config
from synqlab.core.schemas import ExperimentConfig, ToolRequest
```

**Type Checking Imports:**
Use `TYPE_CHECKING` block for forward references to avoid circular imports:
```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from synqlab.agent.context import AgentContext
```

### TypeScript Formatting

**Linting:**
- ESLint 9.x with typescript-eslint
- React hooks and React Refresh plugins
- Config: `frontend/eslint.config.js`

**TypeScript Config:**
- Strict mode enabled
- `noUnusedLocals`, `noUnusedParameters` enforced
- Path alias: `@/*` → `./src/*`
- Target: ES2023

**Imports Organization:**
1. React/external library imports
2. Type imports (using `import type`)
3. Local imports using path alias

**Example from `frontend/src/contexts/AuthContext.tsx`:**
```typescript
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiFetch, ApiError, setApiAuthToken } from '@/lib/api'
```

## Type Annotations

### Python

**Full type hints required.** Every function signature should include type annotations.

**Return type syntax:**
```python
def run(self, request: ToolRequest) -> ToolOutput:
```

**Complex types:**
```python
def check_numerical_claims(
    agent_response: str,
    messages: list[dict[str, Any]],
) -> list[str]:
```

**Optional types:**
```python
def run_experiment(
    config: ExperimentConfig,
    session: Any = None,
    round_id: Optional[str] = None,
) -> ExperimentSummary:
```

### TypeScript

**Explicit interface definitions for props:**
```typescript
interface BudgetMeterProps {
  usage: UsageSummary
  size?: number
}
```

**Use `type` imports for types-only:**
```typescript
import type { Tool, Category, HealthMap } from '@/types'
```

**Generic function types:**
```typescript
async function get<T>(path: string): Promise<T>
```

## Error Handling

### Python

**Custom exception hierarchy** in `synqlab/core/exceptions.py`:
- `RegistryError` — tool registry issues
- `AdapterError` — tool adapter failures
- `StorageError` — DB/filesystem failures
- `ConfigError` — configuration problems
- `AuthError` — authentication failures (`synqlab/auth/exceptions.py`)

**Pattern: Raise domain-specific exceptions:**
```python
from synqlab.auth.exceptions import AuthError

def create_user(session, email, password, name):
    if existing_user:
        raise AuthError("Email already registered")
```

**Pattern: Log and re-raise in adapters:**
```python
try:
    # operation
except Exception as exc:
    logger.warning("Failed to create experiment record: %s", exc)
```

### TypeScript

**Custom error class for API:**
```typescript
import { ApiError } from '@/lib/api'

try {
  const response = await apiFetch('/auth/login', { ... })
} catch (error) {
  if (error instanceof ApiError) {
    throw new Error(error.message)
  }
  throw error
}
```

**Simple error throwing for HTTP:**
```typescript
if (!res.ok) throw new Error(`HTTP ${res.status}`)
```

## Logging

### Python

**Framework:** Standard library `logging`

**Setup pattern:**
```python
import logging
logger = logging.getLogger(__name__)
```

**Usage levels:**
- `logger.info()` — stage progress, completion
- `logger.warning()` — non-fatal failures
- `logger.debug()` — detailed diagnostics (not commonly used)

**Example:**
```python
logger.info("Stage 1: Generating %d sequences via ProtGPT2.", config.n_sequences)
logger.warning("Failed to create experiment record: %s", exc)
```

### TypeScript

**Console-based** — no structured logging framework.

## Comments and Docstrings

### Python

**Module docstrings:** Required. Describe purpose and key components.
```python
"""Post-response guardrails for the agent system.

Provides validation layers that check agent output quality
before returning to users. Currently implements:

1. Numerical claim verification — checks that numbers in agent
   text match numbers from tool outputs in the conversation.
2. Dead-artifact-claim stripping — removes hallucinated phrases.
"""
```

**Function docstrings:** For public functions. Describe behavior and return value.
```python
def extract_numbers(text: str) -> set[str]:
    """Extract all numeric strings from text."""
```

**Class docstrings:** Brief description of purpose.
```python
class BaseAdapter(abc.ABC):
    """Abstract base class for all SynqLab tool adapters."""
```

**Inline comments:** Use `# ──` section markers for visual separation:
```python
# ── Stage 1: Generate ────────────────────────────────────────────────────
# ── Numerical claim guardrail ───────────────────────────────────────────────
```

### TypeScript

**JSDoc for components:**
```typescript
/**
 * BudgetMeter — circular SVG gauge showing session token usage vs budget limit.
 */
```

**Inline comments for complex logic:**
```typescript
// Color transitions: green → amber → red.
const color = ratio >= 0.9 ? 'stroke-red-500' : ...
```

## Function Design

### Python

**Dataclasses for structured data:**
```python
@dataclass
class ToolResult:
    data: dict[str, Any]
    status: ToolResultStatus = ToolResultStatus.SUCCESS
    error_message: str | None = None
```

**Factory class methods:**
```python
@classmethod
def ok(cls, data: dict[str, Any]) -> "ToolResult":
    return cls(data=data, status=ToolResultStatus.SUCCESS)
```

**Builder pattern for tools:**
```python
def build_tool(definition: AgentToolDef) -> AgentTool:
    """Build a complete AgentTool from a partial definition."""
```

### TypeScript

**React hooks pattern:**
```typescript
const [user, setUser] = useState<AuthUser | null>(null)

const login = useCallback(
  async (email: string, password: string) => {
    // implementation
  },
  [applyAuthPayload],
)
```

**Memoized context values:**
```typescript
const value = useMemo<AuthContextValue>(
  () => ({ user, token, login, signup, ... }),
  [user, token, login, signup, ...],
)
```

## Module Design

### Python

**Domain-driven structure:**
- `synqlab/agent/` — agent system (engine, tools, context)
- `synqlab/adapters/` — external tool adapters
- `synqlab/auth/` — authentication
- `synqlab/core/` — shared schemas, exceptions, config
- `synqlab/storage/` — database models and services

**`__init__.py` exports:** Selective public API exports.

### TypeScript

**Feature-based structure:**
- `features/<domain>/components/` — React components
- `features/<domain>/hooks/` — custom hooks
- `features/<domain>/types.ts` — domain types
- `features/<domain>/helpers.ts` — utility functions

**Barrel exports via `index.ts`:**
```typescript
// frontend/src/components/blocks/index.ts
export { PageHeader } from './PageHeader'
export { TagChip } from './TagChip'
```

## Path Aliases

### TypeScript

**Configured in `tsconfig.app.json` and `vite.config.ts`:**
```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

**Usage:**
```typescript
import { api } from '@/api/client'
import type { Tool } from '@/types'
```

## Styling (Frontend)

**Framework:** Tailwind CSS 3.x

**Class merging utility:**
```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Component libraries:**
- Radix UI primitives for accessibility
- shadcn/ui patterns for components
- Lucide for icons

---

*Convention analysis: 2026-05-02*
