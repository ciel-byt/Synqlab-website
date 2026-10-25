import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  FlaskConical, Cpu, BarChart2, Repeat2, Database, Upload,
  ArrowDown, ChevronRight,
} from 'lucide-react'
import { ModularPageLayout } from '@/components/layout/ModularPageLayout'
import { PageSidebar } from '@/components/layout/PageSidebar'
import { SidebarCollapsibleGroup } from '@/components/layout/SidebarCollapsibleGroup'
import { SidebarListItem } from '@/components/ui/sidebar-list-item'


// ── Types ────────────────────────────────────────────────────────────────────

interface FlowNode {
  tag: string
  tagColor: string
  label: string
  file: string
  desc: string
  indent?: 0 | 1 | 2
  last?: boolean
  dotColor?: string
}

interface IOExample {
  input: object
  output: object
}

interface ToolFlow {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  accentBg: string
  accentText: string
  tagCls: string
  dotColor: string
  summary: string
  nodes: FlowNode[]
  example: IOExample
}

// ── Tag pill ─────────────────────────────────────────────────────────────────

function Tag({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={cn('text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded', cls)}>
      {label}
    </span>
  )
}

// ── Single flow node card ─────────────────────────────────────────────────────

function Node({ node }: { node: FlowNode }) {
  const indentPx = (node.indent ?? 0) * 28
  return (
    <div className="flex items-stretch min-w-0" style={{ paddingLeft: indentPx }}>
      {/* rail */}
      <div className="flex flex-col items-center w-7 flex-shrink-0">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-[18px] z-10"
          style={{ background: node.dotColor ?? '#94a3b8' }}
        />
        {!node.last && <div className="w-px flex-1 bg-muted mt-0.5" />}
      </div>
      {/* card */}
      <div className="flex-1 ml-2 my-1.5 border border-border rounded-lg bg-card px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,.04)] min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <Tag label={node.tag} cls={node.tagColor} />
          <span className="text-[13px] font-semibold text-foreground">{node.label}</span>
        </div>
        <p className="text-[10.5px] font-mono text-muted-foreground/70 mb-1">{node.file}</p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">{node.desc}</p>
      </div>
    </div>
  )
}

// ── IO Example panel ─────────────────────────────────────────────────────────

function IOPanel({ example, accentBg, accentText }: { example: IOExample; accentBg: string; accentText: string }) {
  const [view, setView] = useState<'input' | 'output'>('input')
  return (
    <div className="mt-6 border border-border rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      <div className="flex items-center border-b border-border bg-muted/30">
        {(['input', 'output'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'px-4 py-2 text-[12px] font-semibold transition-colors capitalize',
              view === v
                ? cn('bg-card border-b-2 -mb-px', accentText, 'border-current')
                : 'text-muted-foreground/70 hover:text-muted-foreground',
            )}
          >
            {v === 'input' ? '→ Example Input' : '← Example Output'}
          </button>
        ))}
        <span className={cn('ml-auto mr-3 text-[10px] font-mono px-2 py-0.5 rounded', accentBg, accentText)}>
          {view === 'input' ? 'request.inputs' : 'ToolOutput.outputs'}
        </span>
      </div>
      <pre className="p-4 text-[11.5px] font-mono text-foreground/80 bg-card leading-relaxed overflow-x-auto">
        {JSON.stringify(view === 'input' ? example.input : example.output, null, 2)}
      </pre>
    </div>
  )
}

// ── Tool flow data ────────────────────────────────────────────────────────────

const FLOWS: ToolFlow[] = [
  // ── Full Pipeline ──────────────────────────────────────────────────────────
  {
    id: 'pipeline',
    label: 'Full Pipeline',
    icon: FlaskConical,
    accentBg: 'bg-violet-50 dark:bg-violet-950/30',
    accentText: 'text-violet-600 dark:text-violet-300',
    tagCls: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
    dotColor: '#7c3aed',
    summary: 'Runs all 5 stages end-to-end: generate → structure → stability → rerank → select top-k.',
    nodes: [
      {
        tag: 'HTTP', tagColor: 'bg-violet-100 text-violet-700', dotColor: '#7c3aed',
        label: 'POST /api/run-pipeline',
        file: 'ui/server.py → run_pipeline()',
        desc: 'Returns {job_id} immediately. Submits work to ThreadPoolExecutor — pipeline runs in background.',
      },
      {
        tag: 'THREAD', tagColor: 'bg-violet-100 text-violet-700', dotColor: '#7c3aed',
        label: '_run_pipeline_worker()',
        file: 'ui/server.py',
        desc: 'Builds ExperimentConfig, calls run_experiment(config).',
      },
      {
        tag: 'ORCHESTRATOR', tagColor: 'bg-violet-100 text-violet-700', dotColor: '#7c3aed',
        label: 'run_experiment(config)',
        file: 'synqlab/orchestrator/pipeline.py',
        desc: 'Instantiates all 4 adapters. Runs stages 1–5 in sequence. Applies gates via V1Policy.',
      },
      {
        tag: 'STAGE 1', tagColor: 'bg-emerald-100 text-emerald-700', dotColor: '#059669',
        label: 'execute_tool("protgpt2", …)',
        file: 'synqlab/engine/executor.py → synqlab/adapters/protgpt2.py',
        desc: 'Generates N amino-acid sequences using ProtGPT2 (HuggingFace).',
        indent: 1,
      },
      {
        tag: 'STAGE 2', tagColor: 'bg-sky-100 text-sky-700', dotColor: '#0284c7',
        label: 'execute_tool("omegafold", …) × N',
        file: 'synqlab/engine/executor.py → synqlab/adapters/omegafold.py',
        desc: 'Predicts 3-D structure per sequence. policy.apply_gate1() drops sequences where pLDDT < threshold.',
        indent: 1,
      },
      {
        tag: 'STAGE 3', tagColor: 'bg-amber-100 text-amber-700', dotColor: '#d97706',
        label: 'execute_tool("foldx", …) × survivors',
        file: 'synqlab/engine/executor.py → synqlab/adapters/foldx.py',
        desc: 'Scores stability (ΔΔG) for each survivor. policy.apply_gate2() drops ΔΔG > threshold.',
        indent: 1,
      },
      {
        tag: 'STAGE 4', tagColor: 'bg-pink-100 text-pink-700', dotColor: '#db2777',
        label: 'execute_tool("reranker", …) — optional',
        file: 'synqlab/engine/executor.py → synqlab/adapters/reranker.py',
        desc: 'ML-based scoring. Skipped gracefully if no trained model artifact is found.',
        indent: 1,
      },
      {
        tag: 'STAGE 5', tagColor: 'bg-violet-100 text-violet-700', dotColor: '#7c3aed',
        label: 'policy.select_top_k()',
        file: 'synqlab/orchestrator/policy.py',
        desc: 'Picks best k candidates. Writes artifacts/{exp_id}/{round_id}/pipeline/summary/experiment_summary.json.',
        indent: 1,
        last: true,
      },
    ],
    example: {
      input: {
        prompt: 'Run a full V1 pipeline',
        n_sequences: 10,
        plddt_threshold: 70.0,
        ddg_threshold: 2.0,
        top_k: 3,
      },
      output: {
        experiment_id: 'f8908094-86e9-4281-b3c0-6298e809789b',
        round_id: 'round_8af242f1',
        n_generated: 10,
        n_passed_gate1: 6,
        n_passed_gate2: 3,
        n_top_k: 3,
        top_k_sequences: ['MKTIIALSYIFCLVFA', 'ACDEFGHIKLMNPQRS', 'VWYLHFNQSTDAEKRG'],
        top_k_scores: [
          { plddt: 82.3, ddg: -1.5 },
          { plddt: 78.1, ddg: -0.9 },
          { plddt: 74.5, ddg: 0.2 },
        ],
      },
    },
  },

  // ── ProtGPT2 ───────────────────────────────────────────────────────────────
  {
    id: 'protgpt2',
    label: 'ProtGPT2',
    icon: FlaskConical,
    accentBg: 'bg-emerald-50 dark:bg-emerald-950/30',
    accentText: 'text-emerald-700 dark:text-emerald-300',
    tagCls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    dotColor: '#059669',
    summary: 'Unconditional autoregressive protein sequence generator. Runs on HuggingFace transformers.',
    nodes: [
      {
        tag: 'HTTP', tagColor: 'bg-emerald-100 text-emerald-700', dotColor: '#059669',
        label: 'POST /api/run-tool  {tool_id: "protgpt2"}',
        file: 'ui/server.py → run_tool()',
        desc: 'Returns {job_id, status: "queued"} instantly. Submits to ThreadPoolExecutor.',
      },
      {
        tag: 'THREAD', tagColor: 'bg-emerald-100 text-emerald-700', dotColor: '#059669',
        label: '_run_tool_worker(job_id, "protgpt2", inputs)',
        file: 'ui/server.py',
        desc: 'Loads registry → builds ToolRequest → calls resolve_adapter(tool_def)',
      },
      {
        tag: 'RESOLVER', tagColor: 'bg-emerald-100 text-emerald-700', dotColor: '#059669',
        label: 'resolve_adapter(tool_def)',
        file: 'synqlab/engine/adapter_resolver.py',
        desc: 'Looks up "ProtGPT2Adapter" in _ADAPTER_MODULE_MAP → imports synqlab.adapters.protgpt2 → instantiates.',
      },
      {
        tag: 'EXECUTOR', tagColor: 'bg-emerald-100 text-emerald-700', dotColor: '#059669',
        label: 'execute_tool(adapter, request)',
        file: 'synqlab/engine/executor.py',
        desc: 'Records start time. Calls adapter.run(request). Writes ToolRun to DB. Returns ToolOutput.',
      },
      {
        tag: 'ADAPTER', tagColor: 'bg-emerald-100 text-emerald-700', dotColor: '#059669',
        label: 'ProtGPT2Adapter.run(request)',
        file: 'synqlab/adapters/protgpt2.py',
        desc: 'Extracts n_sequences, max_length, temperature from request.inputs.',
        indent: 1,
      },
      {
        tag: 'LAZY LOAD', tagColor: 'bg-muted text-muted-foreground', dotColor: '#94a3b8',
        label: '_load_model()  — first call only',
        file: 'synqlab/adapters/protgpt2.py',
        desc: 'Downloads nferruz/ProtGPT2 to ~/.cache/huggingface/ (~1.5 GB). Builds HuggingFace text-generation pipeline.',
        indent: 2,
      },
      {
        tag: 'INFERENCE', tagColor: 'bg-emerald-100 text-emerald-700', dotColor: '#059669',
        label: 'self._pipeline("<|endoftext|>", …)',
        file: 'HuggingFace transformers',
        desc: 'GPT-2 autoregressive generation over amino-acid vocabulary. Returns list of sequences.',
        indent: 2,
        last: true,
      },
    ],
    example: {
      input: {
        n_sequences: 5,
        max_length: 100,
        temperature: 1.0,
      },
      output: {
        sequences: [
          'MKTIIALSYIFCLVFADYKDDDDK',
          'ACDEFGHIKLMNPQRSTVWY',
          'GSSHHHHHHSSGLVPRGSH',
          'MASRGVNKEFLHYMIRQNST',
          'LKDLSIVAGVSTGLGKTTQIP',
        ],
        generation_metadata: {
          model: 'nferruz/ProtGPT2',
          temperature: 1.0,
          n_generated: 5,
        },
      },
    },
  },

  // ── OmegaFold ──────────────────────────────────────────────────────────────
  {
    id: 'omegafold',
    label: 'OmegaFold',
    icon: Cpu,
    accentBg: 'bg-sky-50 dark:bg-sky-950/30',
    accentText: 'text-sky-700 dark:text-sky-300',
    tagCls: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
    dotColor: '#0284c7',
    summary: 'Single-sequence structure predictor. No MSA required. Downloads ~3 GB weights on first run.',
    nodes: [
      {
        tag: 'HTTP', tagColor: 'bg-sky-100 text-sky-700', dotColor: '#0284c7',
        label: 'POST /api/run-tool  {tool_id: "omegafold"}',
        file: 'ui/server.py → run_tool()',
        desc: 'Returns {job_id} instantly. Dispatches to ThreadPoolExecutor — inference takes minutes.',
      },
      {
        tag: 'THREAD', tagColor: 'bg-sky-100 text-sky-700', dotColor: '#0284c7',
        label: '_run_tool_worker()',
        file: 'ui/server.py',
        desc: 'Loads registry → builds ToolRequest → resolve_adapter() → execute_tool()',
      },
      {
        tag: 'ADAPTER', tagColor: 'bg-sky-100 text-sky-700', dotColor: '#0284c7',
        label: 'OmegaFoldAdapter.run(request)',
        file: 'synqlab/adapters/omegafold.py',
        desc: 'Extracts sequence. Creates output directory. Calls _run_real(sequence, out_dir).',
        indent: 1,
      },
      {
        tag: 'LAZY LOAD', tagColor: 'bg-muted text-muted-foreground', dotColor: '#94a3b8',
        label: '_load_model()  — first call only',
        file: 'synqlab/adapters/omegafold.py',
        desc: 'Downloads model weights to ~/.cache/omegafold_ckpt/model.pt (~3 GB). Loads neural net. Moves to cpu / mps / cuda.',
        indent: 2,
      },
      {
        tag: 'PREP', tagColor: 'bg-sky-100 text-sky-700', dotColor: '#0284c7',
        label: 'fasta2inputs()',
        file: '/tmp/OmegaFold/omegafold/pipeline.py',
        desc: 'Writes input.fasta. Tokenises sequence. Generates pseudo-MSA. Returns input tensors.',
        indent: 2,
      },
      {
        tag: 'INFERENCE', tagColor: 'bg-sky-100 text-sky-700', dotColor: '#0284c7',
        label: 'OmegaFold.forward()',
        file: '/tmp/OmegaFold/omegafold/model.py',
        desc: '50-block geometric transformer. Predicts final_atom_positions + per-residue confidence tensors.',
        indent: 2,
      },
      {
        tag: 'SAVE', tagColor: 'bg-sky-100 text-sky-700', dotColor: '#0284c7',
        label: 'save_pdb()',
        file: '/tmp/OmegaFold/omegafold/pipeline.py',
        desc: 'Writes 3-D atom coordinates to artifacts/…/query.pdb.',
        indent: 2,
        last: true,
      },
    ],
    example: {
      input: {
        sequence: 'MKTIIALSYIFCLVFA',
      },
      output: {
        pdb_path: 'artifacts/exp_abc/round_001/omegafold/query.pdb',
        confidence: 72.4,
        per_residue_plddt: [68.1, 71.3, 75.2, 80.0, 78.9, 74.1, 65.3, 70.2, 72.8, 71.5, 69.4, 73.1, 76.8, 79.2, 74.6, 67.3],
      },
    },
  },

  // ── FoldX ──────────────────────────────────────────────────────────────────
  {
    id: 'foldx',
    label: 'FoldX',
    icon: BarChart2,
    accentBg: 'bg-amber-50 dark:bg-amber-950/30',
    accentText: 'text-amber-700 dark:text-amber-300',
    tagCls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    dotColor: '#d97706',
    summary: 'Physics-based ΔΔG stability scorer. Runs the FoldX binary via subprocess. CPU-only.',
    nodes: [
      {
        tag: 'HTTP', tagColor: 'bg-amber-100 text-amber-700', dotColor: '#d97706',
        label: 'POST /api/run-tool  {tool_id: "foldx"}',
        file: 'ui/server.py → run_tool()',
        desc: 'Returns {job_id} instantly. Dispatches to ThreadPoolExecutor.',
      },
      {
        tag: 'THREAD', tagColor: 'bg-amber-100 text-amber-700', dotColor: '#d97706',
        label: '_run_tool_worker()',
        file: 'ui/server.py',
        desc: 'Loads registry → ToolRequest → resolve_adapter() → execute_tool()',
      },
      {
        tag: 'ADAPTER', tagColor: 'bg-amber-100 text-amber-700', dotColor: '#d97706',
        label: 'FoldXAdapter.run(request)',
        file: 'synqlab/adapters/foldx.py',
        desc: 'Extracts pdb_path, optional mutations. Creates temp work dir. Calls _run_real().',
        indent: 1,
      },
      {
        tag: 'CONFIG', tagColor: 'bg-muted text-muted-foreground', dotColor: '#94a3b8',
        label: '_resolve_binary()',
        file: 'synqlab/adapters/foldx.py',
        desc: 'Priority: SYNQLAB_FOLDX_BINARY_PATH env → configs/local.yaml → tools.foldx.binary_path → raises AdapterError if missing.',
        indent: 2,
      },
      {
        tag: 'SUBPROCESS 1', tagColor: 'bg-amber-100 text-amber-700', dotColor: '#d97706',
        label: 'foldx --command=RepairPDB',
        file: 'resources/foldx5_Mac_0/foldx_20270131  (binary)',
        desc: 'Repairs PDB hydrogen/bond geometry before scoring. Writes *_Repair.pdb.',
        indent: 2,
      },
      {
        tag: 'SUBPROCESS 2', tagColor: 'bg-amber-100 text-amber-700', dotColor: '#d97706',
        label: 'foldx --command=Stability (or BuildModel)',
        file: 'resources/foldx5_Mac_0/foldx_20270131  (binary)',
        desc: 'Physics-based free-energy calculation. Writes *.fxout result files.',
        indent: 2,
      },
      {
        tag: 'PARSE', tagColor: 'bg-amber-100 text-amber-700', dotColor: '#d97706',
        label: '_parse_ddg()',
        file: 'synqlab/adapters/foldx.py',
        desc: 'Reads tab-separated *.fxout. Extracts ΔΔG column value.',
        indent: 2,
        last: true,
      },
    ],
    example: {
      input: {
        pdb_path: 'artifacts/exp_abc/round_001/omegafold/query.pdb',
        mutations: [],
      },
      output: {
        ddg: -1.2,
        raw_output_path: 'artifacts/exp_abc/round_001/foldx/foldx_output.txt',
      },
    },
  },

  // ── Reranker ───────────────────────────────────────────────────────────────
  {
    id: 'reranker',
    label: 'Reranker',
    icon: Repeat2,
    accentBg: 'bg-pink-50 dark:bg-pink-950/30',
    accentText: 'text-pink-700 dark:text-pink-300',
    tagCls: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
    dotColor: '#db2777',
    summary: 'Lightweight sklearn model trained on accumulated labels. Predicts P(hit) from {plddt, ddg} features.',
    nodes: [
      {
        tag: 'HTTP', tagColor: 'bg-pink-100 text-pink-700', dotColor: '#db2777',
        label: 'POST /api/run-tool  {tool_id: "reranker"}',
        file: 'ui/server.py → run_tool()',
        desc: 'Returns {job_id} instantly. Dispatches to ThreadPoolExecutor.',
      },
      {
        tag: 'THREAD', tagColor: 'bg-pink-100 text-pink-700', dotColor: '#db2777',
        label: '_run_tool_worker()',
        file: 'ui/server.py',
        desc: 'Loads registry → ToolRequest → resolve_adapter() → execute_tool()',
      },
      {
        tag: 'ADAPTER', tagColor: 'bg-pink-100 text-pink-700', dotColor: '#db2777',
        label: 'RerankerAdapter.run(request)',
        file: 'synqlab/adapters/reranker.py',
        desc: 'Extracts feature_vector: {plddt, ddg} from request.inputs.',
        indent: 1,
      },
      {
        tag: 'LOAD', tagColor: 'bg-muted text-muted-foreground', dotColor: '#94a3b8',
        label: '_load_model()',
        file: 'synqlab/adapters/reranker.py',
        desc: 'Opens artifacts/reranker/model.pkl. If missing → returns {skipped: true} gracefully.',
        indent: 2,
      },
      {
        tag: 'INFERENCE', tagColor: 'bg-pink-100 text-pink-700', dotColor: '#db2777',
        label: 'model.predict_proba(features)',
        file: 'scikit-learn (sklearn)',
        desc: 'Logistic regression on [plddt, ddg]. Train first: python scripts/train_reranker.py',
        indent: 2,
        last: true,
      },
    ],
    example: {
      input: {
        feature_vector: { plddt: 78.3, ddg: -0.9 },
      },
      output: {
        score: 0.84,
        model_version: 'v1',
      },
    },
  },

  // ── Label Ingest ───────────────────────────────────────────────────────────
  {
    id: 'ingest',
    label: 'Label Ingest',
    icon: Upload,
    accentBg: 'bg-teal-50 dark:bg-teal-950/30',
    accentText: 'text-teal-700 dark:text-teal-300',
    tagCls: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
    dotColor: '#0d9488',
    summary: 'Reads CSV/XLSX fluorescence readouts and registers them in the Knowledge Store.',
    nodes: [
      {
        tag: 'ENTRY', tagColor: 'bg-teal-100 text-teal-700', dotColor: '#0d9488',
        label: 'POST /api/run-tool  or  python scripts/ingest_brightness.py',
        file: 'ui/server.py  —or—  scripts/ingest_brightness.py',
        desc: 'Provide inputs: file_path, sequence_column, label_column, project_id.',
      },
      {
        tag: 'RESOLVE', tagColor: 'bg-teal-100 text-teal-700', dotColor: '#0d9488',
        label: 'resolve_adapter("fluorescence_label_ingest")',
        file: 'synqlab/engine/adapter_resolver.py',
        desc: 'Maps to FluorescenceLabelIngestAdapter in synqlab.adapters.label_ingest.',
      },
      {
        tag: 'ADAPTER', tagColor: 'bg-teal-100 text-teal-700', dotColor: '#0d9488',
        label: 'FluorescenceLabelIngestAdapter.run(request)',
        file: 'synqlab/adapters/label_ingest.py',
        desc: 'Reads inputs, resolves file format from extension.',
        indent: 1,
      },
      {
        tag: 'READ', tagColor: 'bg-teal-100 text-teal-700', dotColor: '#0d9488',
        label: 'pandas.read_csv() / read_excel()',
        file: 'pandas (library)',
        desc: 'Loads dataset. Validates columns exist. Drops NaN rows.',
        indent: 2,
      },
      {
        tag: 'STORE', tagColor: 'bg-teal-100 text-teal-700', dotColor: '#0d9488',
        label: 'KnowledgeStore.register(artifact)',
        file: 'synqlab/knowledge_store/store.py',
        desc: 'Persists dataset metadata (path, columns, n_rows, tags) in the in-memory Knowledge Store.',
        indent: 2,
        last: true,
      },
    ],
    example: {
      input: {
        file_path: 'data/brightness_dataset.csv',
        sequence_column: 'sequence',
        label_column: 'brightness',
        project_id: 'synqlab-v1',
      },
      output: {
        artifact_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        n_registered: 113,
      },
    },
  },

  // ── Experiment Store ───────────────────────────────────────────────────────
  {
    id: 'store',
    label: 'Exp Store',
    icon: Database,
    accentBg: 'bg-rose-50 dark:bg-rose-950/30',
    accentText: 'text-rose-700 dark:text-rose-300',
    tagCls: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
    dotColor: '#e11d48',
    summary: 'Persistence layer for runs, candidates, scores, and artifacts. Backed by PostgreSQL.',
    nodes: [
      {
        tag: 'ENTRY', tagColor: 'bg-rose-100 text-rose-700', dotColor: '#e11d48',
        label: 'POST /api/run-tool  or called automatically by executor',
        file: 'ui/server.py  —or—  synqlab/engine/executor.py (internal)',
        desc: 'Actions: record_artifact or attach_tag. Called after every tool run to persist results.',
      },
      {
        tag: 'RESOLVE', tagColor: 'bg-rose-100 text-rose-700', dotColor: '#e11d48',
        label: 'resolve_adapter("experiment_store")',
        file: 'synqlab/engine/adapter_resolver.py',
        desc: 'Maps to ExperimentStoreAdapter in synqlab.adapters.experiment_store.',
      },
      {
        tag: 'ADAPTER', tagColor: 'bg-rose-100 text-rose-700', dotColor: '#e11d48',
        label: 'ExperimentStoreAdapter.run(request)',
        file: 'synqlab/adapters/experiment_store.py',
        desc: 'Gets or creates a DB session. Dispatches to service layer based on action field.',
        indent: 1,
      },
      {
        tag: 'SERVICE', tagColor: 'bg-rose-100 text-rose-700', dotColor: '#e11d48',
        label: 'record_artifact() / attach_tag()',
        file: 'synqlab/storage/service.py',
        desc: 'SQLAlchemy ORM calls. Writes Artifact or Tag rows to the database.',
        indent: 2,
      },
      {
        tag: 'DB', tagColor: 'bg-rose-100 text-rose-700', dotColor: '#e11d48',
        label: 'PostgreSQL',
        file: 'synqlab/storage/models.py — tables: Experiment, ToolRun, Artifact, Tag',
        desc: 'Configured via SYNQLAB_DB_URL env or configs/local.yaml → database.url.',
        indent: 2,
        last: true,
      },
    ],
    example: {
      input: {
        action: 'record_artifact',
        experiment_id: 'f8908094-86e9-4281-b3c0-6298e809789b',
        artifact_type: 'pdb',
        artifact_path: 'artifacts/exp_abc/round_001/omegafold/query.pdb',
        metadata: { confidence: 72.4 },
      },
      output: {
        stored: true,
        artifact_id: 'c3d4e5f6-a7b8-9012-cdef-123456789abc',
      },
    },
  },
]

// ── Pipeline stage summary bar ────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { n: '1', label: 'Generate', tool: 'ProtGPT2', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-800/40', gate: null },
  { n: '2', label: 'Structure', tool: 'OmegaFold', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/30 border-sky-100 dark:border-sky-800/40', gate: 'Gate 1 · pLDDT' },
  { n: '3', label: 'Stability', tool: 'FoldX', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-800/40', gate: 'Gate 2 · ΔΔG' },
  { n: '4', label: 'Rerank', tool: 'Reranker', color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-950/30 border-pink-100 dark:border-pink-800/40', gate: 'optional' },
  { n: '5', label: 'Select', tool: 'top-k', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-800/40', gate: null },
]

function PipelineBar() {
  return (
    <div className="flex gap-2 mb-8">
      {PIPELINE_STAGES.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2 flex-1">
          <div className={cn('flex-1 rounded-lg border px-3 py-2.5 text-center min-h-[100px] flex flex-col items-center justify-center', s.bg)}>
            <p className="text-[10px] font-mono text-muted-foreground/70 mb-0.5">STAGE {s.n}</p>
            <p className={cn('text-[12px] font-bold', s.color)}>{s.label}</p>
            <p className="text-[10.5px] text-muted-foreground/70">{s.tool}</p>
            {s.gate && (
              <span className={cn('mt-1.5 inline-block text-[9.5px] font-mono px-1.5 py-0.5 rounded', s.bg, s.color)}>
                {s.gate}
              </span>
            )}
          </div>
          {i < PIPELINE_STAGES.length - 1 && (
            <ArrowDown size={12} className="text-muted-foreground/50 flex-shrink-0 rotate-[-90deg]" />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Sidebar categories ───────────────────────────────────────────────────────────

const SIDEBAR_GROUPS = [
  { title: 'Pipeline', titleColor: 'text-rose-600 dark:text-rose-300/80', ids: ['pipeline'] },
  { title: 'Computers', titleColor: 'text-sky-600 dark:text-sky-300/80', ids: ['protgpt2', 'omegafold', 'foldx', 'reranker'] },
  { title: 'Data', titleColor: 'text-emerald-600 dark:text-emerald-300/80', ids: ['ingest', 'store'] },
]

// ── Page ─────────────────────────────────────────────────────────────────

export function FlowsPage() {
  const [active, setActive] = useState('pipeline')
  const flow = FLOWS.find(f => f.id === active)!

  const sidebar = (
    <PageSidebar title="Request Flow">
      {SIDEBAR_GROUPS.map(group => (
        <SidebarCollapsibleGroup key={group.title} title={group.title} titleClassName={group.titleColor} defaultOpen>
          {group.ids.map(id => {
            const f = FLOWS.find(fl => fl.id === id)!
            const Icon = f.icon
            return (
              <SidebarListItem
                key={id}
                active={active === id}
                title={f.label}
                icon={<Icon size={13} />}
                onClick={() => setActive(id)}
              />
            )
          })}
        </SidebarCollapsibleGroup>
      ))}
    </PageSidebar>
  )

  return (
    <ModularPageLayout sidebar={sidebar}>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">

          {/* Summary */}
          <div className={cn('rounded-xl border px-4 py-3 mb-6 flex items-start gap-3', flow.accentBg, 'border-border')}>
            <ChevronRight size={15} className={cn('flex-shrink-0 mt-px', flow.accentText)} />
            <p className={cn('text-[12.5px] font-medium', flow.accentText)}>{flow.summary}</p>
          </div>

          {/* Pipeline stages bar (pipeline tab only) */}
          {active === 'pipeline' && <PipelineBar />}

          {/* Flow nodes */}
          <div className="mb-2">
            <p className="text-[10.5px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-3">Call Chain</p>
            <div className="flex flex-col">
              {flow.nodes.map((node, i) => (
                <Node
                  key={i}
                  node={{ ...node, dotColor: node.dotColor ?? flow.dotColor, last: i === flow.nodes.length - 1 }}
                />
              ))}
            </div>
          </div>

          {/* I/O Example */}
          <div className="mt-2">
            <p className="text-[10.5px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-1">Example I/O</p>
            <IOPanel example={flow.example} accentBg={flow.accentBg} accentText={flow.accentText} />
          </div>

        </div>
      </div>
    </ModularPageLayout>
  )
}
