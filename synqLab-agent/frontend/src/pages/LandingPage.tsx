/**
 * SynqLab Landing Page
 * Renders at "/" on synqlab.ai, and at /landing in dev.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { Logo } from '@/components/Logo'
import { ArchScene3D } from '@/components/ArchScene3D'

const DEMO_BOOKING_URL = 'https://calendly.com/sepehrbayat29/synqlab-demo'

// On the marketing root domain (synqlab.ai) the SPA only registers
// landing/blog routes — /login lives on the app subdomain. A plain
// <a href="/login"> there triggers a full-page nav that hits the SPA
// catch-all and redirects back to "/", which is why the Sign In
// button looked like it just "refreshed" the landing page. Resolve
// the correct absolute URL based on the current host.
const SIGN_IN_HREF =
  typeof window !== 'undefined' && window.location.hostname === 'synqlab.ai'
    ? 'https://app.synqlab.ai/login'
    : '/login'

const NAV_LINKS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Architecture', href: '#architecture' },
  { label: 'Use Cases', href: '#use-cases' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '#contact' },
]

// Real numbers from our own pipeline and evaluation runs (aria/eval/ASSESSMENT.md,
// registry/tools.yaml) — used instead of trust-logo placeholders since we don't
// have paying customers to name yet. Verifiable beats aspirational.
const PROOF_POINTS: Array<{ value: string; label: string; count?: number; format?: 'comma' }> = [
  { value: '348,867', count: 348867, format: 'comma', label: 'leak-controlled training pairs (≤30% identity to test)' },
  { value: '35,115', count: 35115, format: 'comma', label: 'held-out test sequences, zero overlap' },
  { value: '49', count: 49, label: 'tools mapped in one registry (7 live today)' },
  { value: '<30 min', label: 'full closed loop, single laptop' },
]

const COMPARISON: Array<{ dimension: string; status_quo: string; synqlab: string }> = [
  {
    dimension: 'Tool integration',
    status_quo: 'Ad-hoc Python scripts per model',
    synqlab: 'Unified registry across 49 tools (7 live today)',
  },
  {
    dimension: 'Experimental data',
    status_quo: 'Lost between runs, unlabelled',
    synqlab: 'Persisted, labelled, fed back to next iteration',
  },
  {
    dimension: 'Scoring',
    status_quo: 'Generic off-the-shelf metrics',
    synqlab: 'Task-specific models trained on your assay data',
  },
  {
    dimension: 'Compute',
    status_quo: 'Fixed allocation per candidate',
    synqlab: 'Budget-aware staging: fast gates first, expensive at the end',
  },
  {
    dimension: 'Reproducibility',
    status_quo: 'Scripts + Slack + spreadsheets',
    synqlab: 'Every run, artefact, and decision versioned in one workspace',
  },
  {
    dimension: 'Iteration speed',
    status_quo: 'Weeks per feedback cycle',
    synqlab: 'Full closed-loop on a laptop in under 30 minutes',
  },
]

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Do I need a GPU cluster to start?',
    a: 'No. The core closed loop runs on a single laptop. As you scale, SynqLab delegates heavy steps (AlphaFold-Multimer, docking, simulation) to whatever compute you have available — local CUDA, an on-prem cluster, or a cloud provider.',
  },
  {
    q: 'How is my experimental data protected?',
    a: 'Every organization is isolated at the database level. Projects, datasets, and models never cross tenancy boundaries. Self-hosted and air-gapped deployments are supported for regulated environments.',
  },
  {
    q: 'Which models are in the registry?',
    a: 'ProtGPT2, PepMLM, RFdiffusion, ProteinMPNN, OmegaFold, ESMFold, AlphaFold2/Multimer, FoldX, DiffDock-PP, GROMACS/OpenMM and more. We add new models as they publish weights — or you can plug in your own via the adapter interface.',
  },
  {
    q: 'Can my wet lab feed experimental measurements back into the loop?',
    a: 'Yes. LIMS and plate-reader integrations are on the Phase 2 roadmap. Today you can already push labelled outcomes via the API or CSV upload and have them influence the next round automatically.',
  },
  {
    q: 'Who is this for?',
    a: 'Computational biologists, protein engineers, drug discovery teams, and applied AI groups inside pharma and biotech. If you run iterative design loops and care about not wasting data, SynqLab is for you.',
  },
  {
    q: 'How do I get access?',
    a: 'We onboard a small number of pilot teams each quarter. Request a demo and we will walk you through the pipeline with your own use case within 30 minutes.',
  },
]




const TOOLS = [
  'ProtGPT2', 'PepMLM', 'RFdiffusion', 'ProteinMPNN',
  'OmegaFold', 'ESMFold', 'AlphaFold2', 'AlphaFold-Multimer',
  'FoldX', 'DiffDock-PP', 'Brightness Model', 'LoRA Fine-Tuning',
]

const FEATURES = [
  {
    icon: '⟳',
    title: 'Digital + Physical Loop',
    body: 'Every outcome — bright, dim, or failed — is stored and fed into the next iteration. SynqLab closes both the in-silico loop and the real lab loop.',
  },
  {
    icon: '◈',
    title: 'Task-Specific Metric Learning',
    body: 'Rather than relying on generic scores, SynqLab trains predictive models from your own experimental data. Optimizing fluorescence? Get a brightness predictor trained on your assay.',
  },
  {
    icon: '⬡',
    title: 'Agent + Lab Orchestration',
    body: 'Describe your goal. The agent routes candidates through compute stages today, and is designed to dispatch jobs to robotic workflows and lab equipment next.',
  },
  {
    icon: '◎',
    title: 'Unified Tool Registry',
    body: 'Structure predictors, generative models, docking engines, and simulators — all accessible through a single interface with no deployment overhead.',
  },
  {
    icon: '∿',
    title: 'Budget-Aware Execution',
    body: 'Not every candidate needs AlphaFold. SynqLab routes sequences through fast gates first, reserving expensive compute for the most promising survivors.',
  },
  {
    icon: '⊕',
    title: 'Persistent Scientific Memory',
    body: 'Experiments, sequences, structures, scores, and instrument readouts are stored in a shared knowledge store. Nothing is lost between runs, teams, or projects.',
  },
]

const USE_CASES = [
  {
    tag: 'Peptide Design',
    title: 'GFP11 Variant Optimization',
    body: 'Design peptide variants that maximize brightness in the split-GFP complementation assay. The loop runs fully automatically — from generation to ranked candidates — in under 30 minutes on a laptop.',
  },
  {
    tag: 'Protein Engineering',
    title: 'Enzyme Activity Improvement',
    body: 'Train an activity predictor from lab measurements, then use it to bias generation toward higher-performing enzyme variants across iterative rounds.',
  },
  {
    tag: 'Drug Discovery',
    title: 'Binder Design & Docking',
    body: 'Generate candidate binders with RFdiffusion, predict complex structure with AlphaFold-Multimer, score binding poses with DiffDock-PP — all in a single orchestrated pipeline.',
  },
]

const ROADMAP = [
  { phase: 'Phase 1 — Now', title: 'Simulation loop', desc: 'Closed-loop pipeline on a single laptop. GFP11 brightness optimization as proof-of-concept.', active: true },
  { phase: 'Phase 2', title: 'Robots + equipment bridge', desc: 'Connect to LIMS, plate readers, liquid handlers, and robotic workcells. First external customers.', active: false },
  { phase: 'Phase 3', title: 'Autonomous closed-loop lab', desc: 'Trigger real experiments from SynqLab and feed instrument signals back automatically. Multi-domain expansion beyond proteins.', active: false },
  { phase: 'Phase 4', title: 'Autonomous discovery', desc: 'Self-improving agents that design, execute, and learn across projects and teams.', active: false },
]

// ── Architecture diagram ──────────────────────────────────────────────────────
// Content taken verbatim from docs/architecture.md (§ The Design Round) so the
// marketing site and the canonical spec stay in sync.

type StageId = 'generate' | 'evaluate' | 'simulate' | 'label' | 'update'

interface Stage {
  id: StageId
  num: string
  title: string
  subtitle: string
  tools: Array<{ name: string; note?: string }>
  output: string
  why: string
}

const STAGES: Stage[] = [
  {
    id: 'generate',
    num: '01',
    title: 'Generate',
    subtitle: 'N candidates',
    tools: [
      { name: 'ProtGPT2',    note: 'unconditional' },
      { name: 'EvoDiff',     note: 'diffusion · inpainting' },
      { name: 'PepMLM',      note: 'target-conditioned' },
      { name: 'RFdiffusion', note: 'structure-space' },
      { name: 'ProteinMPNN', note: 'inverse folding' },
    ],
    output: 'N candidate sequences (budget-controlled)',
    why: 'Early rounds use unconditional generators to cover sequence space. As labels accumulate, the agent shifts toward target-conditioned samplers biased toward high-scoring regions.',
  },
  {
    id: 'evaluate',
    num: '02',
    title: 'Evaluate',
    subtitle: 'staged · cost-ordered',
    tools: [
      { name: 'ESMFold',      note: 'pLDDT · fast structure gate' },
      { name: 'AF-Multimer',  note: 'iPTM / pTM · complex quality' },
      { name: 'DiffDock-PP',  note: 'binding pose confidence' },
      { name: 'FoldX',        note: 'ΔΔG · stability' },
      { name: 'PyRosetta',    note: 'REU · programmable scoring' },
      { name: 'Brightness',   note: 'learned P(y ≥ τ)' },
    ],
    output: 'Filtered, ranked candidate set',
    why: 'Cheap gates run first; only survivors reach expensive tools. Once enough experimental labels exist, the learned brightness model replaces generic scores as the primary ranking signal — this is SynqLab\'s key differentiator from static pipelines.',
  },
  {
    id: 'simulate',
    num: '03',
    title: 'Simulate',
    subtitle: 'top-k only',
    tools: [
      { name: 'GROMACS', note: 'GPU-accelerated MD' },
      { name: 'OpenMM',  note: 'Python-native MD' },
    ],
    output: 'Stability & dynamics profile for top-k',
    why: 'The most expensive step. Applied selectively to top-k from Stage 2. Simulation length is held fixed within an experiment so costs are comparable across rounds.',
  },
  {
    id: 'label',
    num: '04',
    title: 'Label',
    subtitle: 'passes & failures',
    tools: [
      { name: 'Stage-of-elimination' },
      { name: 'Intermediate scores', note: 'pLDDT · iPTM · ΔΔG · brightness' },
      { name: 'Split-GFP assay',     note: 'optional wet-lab readout' },
    ],
    output: 'D = { (s_i, y_i) } — growing labeled set',
    why: 'Every candidate — passed or rejected early — is recorded with all intermediate scores. Negative examples are first-class training data (core research claim H2), not discarded noise.',
  },
  {
    id: 'update',
    num: '05',
    title: 'Update',
    subtitle: 'closed-loop feedback',
    tools: [
      { name: 'Brightness reranker', note: 'retrained every round' },
      { name: 'LoRA / QLoRA',        note: 'optional generator fine-tune' },
    ],
    output: 'Updated models → next round',
    why: 'The brightness model is retrained on all of D each round. When data & budget allow, a LoRA adapter biases the generator toward high-scoring regions. The agent then starts the next round with updated models.',
  },
]

const PLATFORM: Array<{ id: string; title: string; sub: string }> = [
  { id: 'agent',      title: 'Agent / Orchestrator', sub: 'policy · budget · retries' },
  { id: 'registry',   title: 'Tool Registry',        sub: 'canonical contract · adapters' },
  { id: 'execution',  title: 'Execution Layer',      sub: 'sync + async · healthchecks' },
  { id: 'postgres',   title: 'PostgreSQL',           sub: 'metadata · JSONB · provenance' },
  { id: 'artifacts',  title: 'Artifact Store',       sub: 'PDB · trajectories · logs' },
  { id: 'knowledge',  title: 'Knowledge Store',      sub: 'datasets · prompts · findings' },
]

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function ArchDiagram({ active, setActive }: { active: StageId; setActive: (id: StageId) => void }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const draggingRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState({ x: 0.5, y: 0.5 })
  const [depthMode, setDepthMode] = useState(true)
  const [cameraAuto, setCameraAuto] = useState(true)
  const [time, setTime] = useState(0)
  const [hovering, setHovering] = useState(false)

  function onMouseDown(e: React.MouseEvent): void {
    const target = e.target as HTMLElement
    if (target.closest('[data-stage]') || target.closest('button')) return
    draggingRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
    setIsDragging(true)
  }
  function onMouseMove(e: React.MouseEvent): void {
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      setCursor({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      })
    }
    const d = draggingRef.current
    if (!d) return
    setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) })
  }
  function endDrag(): void {
    draggingRef.current = null
    setIsDragging(false)
  }

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    function onWheel(e: WheelEvent): void {
      if (!(e.altKey || e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      setZoom(z => clamp(z * (e.deltaY < 0 ? 1.1 : 0.9), 0.5, 2.2))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function reset(): void { setPan({ x: 0, y: 0 }); setZoom(1) }

  useEffect(() => {
    if (!depthMode) return
    let raf = 0
    const start = performance.now()
    function tick(now: number): void {
      setTime((now - start) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [depthMode])

  // Ambient camera — orbits gently on its own. Fades out while the user is
  // moving the mouse over the canvas so they feel in control, then fades back
  // in after they leave.
  const autoAmp = cameraAuto && !hovering && !isDragging ? 1 : cameraAuto ? 0.35 : 0
  const autoRx = Math.sin(time * 0.35) * 4 * autoAmp
  const autoRy = Math.sin(time * 0.22 + 1.2) * 6 * autoAmp
  const autoZ  = Math.sin(time * 0.5) * 10 * (cameraAuto ? 1 : 0)

  const mouseRx = depthMode && hovering ? (cursor.y - 0.5) * -8 : 0
  const mouseRy = depthMode && hovering ? (cursor.x - 0.5) * 10 : 0

  const tiltX = depthMode ? mouseRx + autoRx : 0
  const tiltY = depthMode ? mouseRy + autoRy : 0
  const bgShiftX = (cursor.x - 0.5) * 18 + Math.sin(time * 0.3) * 8 * autoAmp
  const bgShiftY = (cursor.y - 0.5) * 14 + Math.cos(time * 0.4) * 6 * autoAmp

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-1">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-semibold tracking-[0.22em] uppercase text-primary">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Design Round
          </span>
          <span className="hidden sm:inline text-muted-foreground/70">·</span>
          <span className="hidden sm:inline font-mono text-[10px] text-muted-foreground/70">
            orbit · drag cards freely · drag to pan · <kbd className="px-1 py-0.5 border border-border rounded bg-card">alt</kbd>+scroll to zoom
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums mr-1">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setDepthMode(v => !v)}
            title={depthMode ? 'Flatten view' : 'Enable 3D view'}
            aria-label={depthMode ? 'Flatten view' : 'Enable 3D view'}
            className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[10px] font-mono tracking-[0.18em] uppercase transition-all ${
              depthMode
                ? 'border-primary/40 bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(27,167,167,0.18)]'
                : 'border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1.8 3.6 6 1.6l4.2 2M1.8 3.6v4.8L6 10.4l4.2-2V3.6M1.8 3.6 6 5.6m4.2-2L6 5.6M6 5.6v4.8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            3D
          </button>
          <button
            type="button"
            onClick={() => setCameraAuto(v => !v)}
            title={cameraAuto ? 'Pause camera orbit' : 'Resume camera orbit'}
            aria-label={cameraAuto ? 'Pause camera orbit' : 'Resume camera orbit'}
            disabled={!depthMode}
            className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[10px] font-mono tracking-[0.18em] uppercase transition-all ${
              !depthMode
                ? 'border-border bg-surface text-muted-foreground/50 cursor-not-allowed'
                : cameraAuto
                  ? 'border-primary/40 bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(27,167,167,0.18)]'
                  : 'border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground'
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              {cameraAuto && depthMode && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
              )}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${cameraAuto && depthMode ? 'bg-primary' : 'bg-muted'}`} />
            </span>
            Orbit
          </button>
          <IconBtn label="Zoom out"  onClick={() => setZoom(z => clamp(z * 0.87, 0.5, 2.2))}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </IconBtn>
          <IconBtn label="Zoom in"  onClick={() => setZoom(z => clamp(z * 1.15, 0.5, 2.2))}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </IconBtn>
          <IconBtn label="Reset view" onClick={reset}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6a4 4 0 1 1 1.2 2.85M2 3v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </IconBtn>
        </div>
      </div>

      <div
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => { setHovering(false); endDrag() }}
        className="relative h-[420px] sm:h-[460px] overflow-hidden rounded-xl border border-border bg-[linear-gradient(to_bottom,#fafbfd,#ffffff)] select-none"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          perspective: depthMode ? '1400px' : 'none',
          perspectiveOrigin: '50% 38%',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.55,
            transform: depthMode
              ? `translateZ(-120px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translate(${bgShiftX * 0.6}px, ${bgShiftY * 0.6}px)`
              : 'none',
            transformOrigin: '50% 50%',
            backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.35) 1px, transparent 1px)',
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: depthMode ? 0.22 : 0,
            transform: depthMode
              ? `translateZ(40px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translate(${bgShiftX * 1.4}px, ${bgShiftY * 1.4}px)`
              : 'none',
            transformOrigin: '50% 50%',
            backgroundImage: 'radial-gradient(circle, rgba(27,167,167,0.5) 1px, transparent 1.5px)',
            backgroundSize: `${48 * zoom}px ${48 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(600px 200px at 50% 0%, rgba(27,167,167,0.06), transparent 70%), radial-gradient(400px 200px at 50% 100%, rgba(27,167,167,0.04), transparent 70%)',
          }}
        />
        {depthMode && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(140% 60% at 50% 120%, rgba(15,23,42,0.10), transparent 55%), linear-gradient(to top, rgba(15,23,42,0.04), transparent 55%)',
            }}
          />
        )}


        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transform: depthMode
              ? `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) translateZ(${autoZ}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${zoom})`
              : `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}
        >
          <StageFlow stages={STAGES} active={active} onSelect={setActive} depth3D={depthMode} time={time} />
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/70">
            <span className="inline-block h-1.5 w-4 bg-primary/70 rounded" />
            closed-loop feedback
          </div>
          <div className="text-[10px] font-mono text-muted-foreground/70">
            GFP11 variant prediction · split-GFP assay
          </div>
        </div>
      </div>

    </div>
  )
}

function StageDetails({ active }: { active: StageId }) {
  const selected = STAGES.find(s => s.id === active)!
  return (
    <>
      <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-5 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
              {selected.num}
            </span>
            <h3 className="text-lg font-semibold text-foreground">{selected.title}</h3>
            <span className="text-xs text-muted-foreground/70">· {selected.subtitle}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">{selected.why}</p>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground/70 mb-1.5">Output</div>
            <div className="text-sm text-foreground font-mono">{selected.output}</div>
          </div>
        </div>
        <div className="md:col-span-7 rounded-xl border border-border bg-card p-5">
          <div className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground/70 mb-3">
            Computers &amp; models
          </div>
          <div className="flex flex-col gap-1.5">
            {selected.tools.map(t => (
              <div key={t.name} className="flex items-baseline gap-3 py-1 border-b border-border/50 last:border-b-0">
                <span className="font-mono text-[13px] text-foreground font-semibold min-w-[120px]">{t.name}</span>
                {t.note && <span className="font-mono text-[11px] text-muted-foreground">{t.note}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px flex-1 bg-muted" />
          <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
            Supporting Platform
          </div>
          <div className="h-px flex-1 bg-muted" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {PLATFORM.map(p => (
            <div
              key={p.id}
              className="rounded-lg border border-border bg-card px-3 py-2.5 hover:border-primary/30 hover:bg-primary/[0.04] transition-colors cursor-default"
            >
              <div className="text-[12px] font-semibold text-foreground leading-tight">{p.title}</div>
              <div className="text-[10px] text-muted-foreground mt-1 font-mono leading-snug">{p.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function ArchitectureViewer() {
  const [active, setActive] = useState<StageId>('generate')
  const [view, setView] = useState<'3d' | '2d'>('3d')

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <div className="inline-flex rounded-full border border-border bg-card p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setView('3d')}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-mono tracking-[0.18em] uppercase transition-all ${
              view === '3d'
                ? 'bg-foreground text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <circle cx="6" cy="6" r="2" fill="currentColor" />
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="0.7" fill="none" />
              <ellipse cx="6" cy="6" rx="4.5" ry="1.6" stroke="currentColor" strokeWidth="0.7" fill="none" />
            </svg>
            3D · Space
          </button>
          <button
            type="button"
            onClick={() => setView('2d')}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-mono tracking-[0.18em] uppercase transition-all ${
              view === '2d'
                ? 'bg-foreground text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <rect x="1.5" y="3.5" width="3" height="5" rx="0.5" stroke="currentColor" strokeWidth="0.8" fill="none" />
              <rect x="7.5" y="3.5" width="3" height="5" rx="0.5" stroke="currentColor" strokeWidth="0.8" fill="none" />
              <path d="M4.5 6H7.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="1.2 1.2" />
            </svg>
            2D · Diagram
          </button>
        </div>
      </div>

      {view === '3d' ? (
        <ArchSceneFrame active={active} onSelect={setActive} />
      ) : (
        <ArchDiagram active={active} setActive={setActive} />
      )}

      <StageDetails active={active} />
    </div>
  )
}

function ArchSceneFrame({ active, onSelect }: { active: StageId; onSelect: (id: StageId) => void }) {
  const [autoOrbit, setAutoOrbit] = useState(true)
  const sceneStages = STAGES.map(s => ({ id: s.id, num: s.num, title: s.title, subtitle: s.subtitle }))
  const selected = STAGES.find(s => s.id === active)!

  return (
    <div className="relative h-[480px] sm:h-[560px] overflow-hidden rounded-xl border border-border bg-card">
      <ArchScene3D
        stages={sceneStages}
        active={active}
        onSelect={onSelect}
        autoOrbit={autoOrbit}
      />

      {/* Top-left HUD */}
      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-card/85 backdrop-blur border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-primary shadow-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          Discovery Cycle · 3D
        </span>
        <span className="hidden sm:inline font-mono text-[10px] text-muted-foreground">
          drag to orbit · scroll to zoom · click a compound to focus
        </span>
      </div>

      {/* Selected stage readout */}
      <div className="absolute bottom-3 left-3 rounded-lg bg-card/92 border border-border backdrop-blur-md px-3 py-2 shadow-lg pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
            {selected.num}
          </span>
          <span className="text-sm font-semibold text-foreground">{selected.title}</span>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{selected.subtitle}</div>
      </div>

      {/* Legend: what the glyphs mean in a discovery context */}
      <div className="absolute bottom-3 right-3 rounded-lg bg-card/92 border border-border backdrop-blur-md px-3 py-2 shadow-sm pointer-events-none">
        <div className="text-[9px] font-mono tracking-[0.22em] uppercase text-muted-foreground/70 mb-1">Legend</div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" /> compound
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[2px] w-4 bg-slate-400 rounded" /> candidate flow
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted" /> plate well
          </span>
        </div>
      </div>

      {/* Orbit toggle */}
      <div className="absolute top-3 right-3">
        <button
          type="button"
          onClick={() => setAutoOrbit(v => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono tracking-[0.18em] uppercase transition-all backdrop-blur shadow-sm ${
            autoOrbit
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground'
          }`}
        >
          <span className="relative flex h-1.5 w-1.5">
            {autoOrbit && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />}
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${autoOrbit ? 'bg-primary' : 'bg-muted'}`} />
          </span>
          {autoOrbit ? 'Auto orbit' : 'Paused'}
        </button>
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-foreground/5" />
    </div>
  )
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground hover:shadow-sm transition-all"
    >
      {children}
    </button>
  )
}

// A restrained, brand-led categorical palette for the five pipeline stages —
// one hue family anchored on the primary teal, varied in hue/lightness rather
// than a bright rainbow, so the diagram reads as designed, not decorative.
const STAGE_ACCENT: Record<StageId, { ring: string; bg: string; text: string; dot: string }> = {
  generate: { ring: 'ring-[#207976]/35', bg: 'bg-[#207976]/[0.08]', text: 'text-[#1c6663]', dot: 'bg-[#207976]' },
  evaluate: { ring: 'ring-[#3e6798]/35', bg: 'bg-[#3e6798]/[0.08]', text: 'text-[#33547d]', dot: 'bg-[#3e6798]' },
  simulate: { ring: 'ring-[#a57327]/35', bg: 'bg-[#a57327]/[0.08]', text: 'text-[#8a611f]', dot: 'bg-[#a57327]' },
  label:    { ring: 'ring-[#863c48]/35', bg: 'bg-[#863c48]/[0.08]', text: 'text-[#71333d]', dot: 'bg-[#863c48]' },
  update:   { ring: 'ring-[#644d89]/35', bg: 'bg-[#644d89]/[0.08]', text: 'text-[#544073]', dot: 'bg-[#644d89]' },
}

// Per-stage hex colors for flowing particles (match STAGE_ACCENT visually).
const STAGE_HEX: Record<StageId, string> = {
  generate: '#207976',
  evaluate: '#3e6798',
  simulate: '#a57327',
  label:    '#863c48',
  update:   '#644d89',
}

function StageFlow({ stages, active, onSelect, depth3D = false, time = 0 }: { stages: Stage[]; active: StageId; onSelect: (id: StageId) => void; depth3D?: boolean; time?: number }) {
  const CARD_W = 170
  const CARD_H = 122
  const GAP = 28
  const CONNECTOR_Y = 56
  const PAD_X = 76
  const PAD_Y = 22
  const totalW = stages.length * CARD_W + (stages.length - 1) * GAP + PAD_X * 2

  const [offsets, setOffsets] = useState<Record<StageId, { x: number; y: number }>>({
    generate: { x: 0, y: 0 },
    evaluate: { x: 0, y: 0 },
    simulate: { x: 0, y: 0 },
    label: { x: 0, y: 0 },
    update: { x: 0, y: 0 },
  })
  const [draggingId, setDraggingId] = useState<StageId | null>(null)
  const draggingCardRef = useRef<{
    id: StageId
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  const positions = stages.map((s, i) => ({
    id: s.id,
    x: PAD_X + i * (CARD_W + GAP) + (offsets[s.id]?.x ?? 0),
    y: PAD_Y + (offsets[s.id]?.y ?? 0),
  }))

  const first = positions[0]
  const last = positions[positions.length - 1]
  const maxBottom = positions.reduce((m, p) => Math.max(m, p.y + CARD_H), 0)
  const LOOP_TOP = maxBottom + 16
  const LOOP_BOTTOM = LOOP_TOP + 36
  const LOOP_START_X = last.x + CARD_W - 10
  const LOOP_END_X = first.x + 10
  const LOOP_MID_X = (LOOP_START_X + LOOP_END_X) / 2
  const LOOP_ARC = `M ${LOOP_START_X} ${LOOP_TOP}
    Q ${LOOP_START_X + 90} ${LOOP_TOP} ${LOOP_START_X + 90} ${LOOP_BOTTOM}
    Q ${LOOP_MID_X} ${LOOP_BOTTOM + 18} ${LOOP_END_X - 90} ${LOOP_BOTTOM}
    Q ${LOOP_END_X - 90} ${LOOP_TOP} ${LOOP_END_X} ${LOOP_TOP}`
  // Let the 2D stage grow as cards are dragged lower so the closed-loop line
  // can move with them instead of feeling pinned.
  const totalH = Math.max(290, LOOP_BOTTOM + 58)

  useEffect(() => {
    function onMove(e: MouseEvent): void {
      const d = draggingCardRef.current
      if (!d) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      setOffsets(prev => ({
        ...prev,
        [d.id]: {
          x: clamp(d.originX + dx, -170, 170),
          y: clamp(d.originY + dy, -70, 220),
        },
      }))
    }
    function onUp(): void {
      draggingCardRef.current = null
      setDraggingId(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  function beginCardDrag(id: StageId, e: React.MouseEvent): void {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const prev = offsets[id] ?? { x: 0, y: 0 }
    draggingCardRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      originX: prev.x,
      originY: prev.y,
    }
    setDraggingId(id)
  }

  return (
    <div className="relative" style={{ width: totalW, height: totalH }}>
      <svg
        className="absolute left-0 top-0 pointer-events-none"
        width={totalW}
        height={totalH}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <filter id="flow-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <path id="loopArc" d={LOOP_ARC} />
        </defs>

        {/* Connector segments between each pair of stages, with flowing particles */}
        {stages.slice(0, -1).map((_s, i) => {
          const cur = positions[i]
          const nextPos = positions[i + 1]
          const nextStage = stages[i + 1]
          const xStart = cur.x + CARD_W
          const yStart = cur.y + CONNECTOR_Y
          const xEnd = nextPos.x
          const yEnd = nextPos.y + CONNECTOR_Y
          const color = STAGE_HEX[nextStage.id]
          return (
            <g key={`gap-${i}`}>
              <line
                x1={xStart}
                y1={yStart}
                x2={xEnd}
                y2={yEnd}
                stroke={color}
                strokeWidth="1.25"
                strokeDasharray="3 4"
                opacity="0.35"
              />
              <path
                d={`M ${xEnd - 5} ${yEnd - 3} L ${xEnd} ${yEnd} L ${xEnd - 5} ${yEnd + 3}`}
                stroke={color}
                strokeWidth="1.25"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.8"
              />
              {[0, 1].map(k => (
                <g key={k}>
                  <circle r="3" fill={color} filter="url(#flow-glow)">
                    <animate
                      attributeName="cx"
                      values={`${xStart};${xEnd}`}
                      dur="2.2s"
                      begin={`${i * 0.18 + k * 1.1}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="cy"
                      values={`${yStart};${yEnd}`}
                      dur="2.2s"
                      begin={`${i * 0.18 + k * 1.1}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      keyTimes="0;0.15;0.85;1"
                      dur="2.2s"
                      begin={`${i * 0.18 + k * 1.1}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              ))}
            </g>
          )
        })}

        <path
          d={LOOP_ARC}
          stroke="#1ba7a7"
          strokeWidth="1.25"
          fill="none"
          strokeDasharray="4 5"
          opacity="0.55"
        />
        <path
          d={`M ${LOOP_END_X - 5} ${LOOP_TOP - 5} L ${LOOP_END_X} ${LOOP_TOP} L ${LOOP_END_X - 5} ${LOOP_TOP + 5}`}
          stroke="#1ba7a7"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {[0, 1, 2, 3].map(k => (
          <circle key={`loop-${k}`} r="3.2" fill="#1ba7a7" filter="url(#flow-glow)" opacity="0">
            <animateMotion dur="7s" begin={`${k * 1.75}s`} repeatCount="indefinite">
              <mpath href="#loopArc" />
            </animateMotion>
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              keyTimes="0;0.06;0.94;1"
              dur="7s"
              begin={`${k * 1.75}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}

        <text
          x={LOOP_MID_X}
          y={LOOP_BOTTOM + 24}
          textAnchor="middle"
          fontSize="13"
          fontWeight="600"
          fill="#1ba7a7"
          fontFamily="Inter, sans-serif"
          opacity="0.85"
        >
          closed-loop feedback
        </text>
      </svg>

      {stages.map((s, i) => {
        const p = positions[i]
        const stagger = i * 0.6
        const bob = depth3D ? Math.sin(time * 0.9 + stagger) * 14 : 0
        const layer = depth3D ? (i % 2 === 0 ? 10 : -8) : 0
        const baseZ = depth3D ? layer + bob + (active === s.id ? 22 : 0) : 0
        return (
          <StageCard
            key={s.id}
            stage={s}
            active={active === s.id}
            onSelect={() => onSelect(s.id)}
            onDragStart={(e) => beginCardDrag(s.id, e)}
            isDragging={draggingId === s.id}
            depth3D={depth3D}
            baseZ={baseZ}
            style={{ left: p.x, top: p.y, width: CARD_W }}
          />
        )
      })}
    </div>
  )
}

function StageCard({
  stage,
  active,
  onSelect,
  onDragStart,
  isDragging,
  depth3D = false,
  baseZ = 0,
  style,
}: {
  stage: Stage
  active: boolean
  onSelect: () => void
  onDragStart: (e: React.MouseEvent) => void
  isDragging: boolean
  depth3D?: boolean
  baseZ?: number
  style: React.CSSProperties
}) {
  const accent = STAGE_ACCENT[stage.id]
  const [localTilt, setLocalTilt] = useState<{ rx: number; ry: number; lx: number; ly: number; active: boolean }>({
    rx: 0, ry: 0, lx: 0.5, ly: 0.5, active: false,
  })

  function onMouseMoveCard(e: React.MouseEvent<HTMLButtonElement>): void {
    if (!depth3D || isDragging) return
    const r = e.currentTarget.getBoundingClientRect()
    const lx = (e.clientX - r.left) / r.width
    const ly = (e.clientY - r.top) / r.height
    setLocalTilt({
      rx: (0.5 - ly) * 12,
      ry: (lx - 0.5) * 14,
      lx, ly,
      active: true,
    })
  }
  function onMouseLeaveCard(): void {
    setLocalTilt(t => ({ ...t, rx: 0, ry: 0, active: false }))
  }

  const liftZ = isDragging ? 44 : localTilt.active ? 18 : 0
  const totalZ = baseZ + liftZ
  const tiltStr = depth3D
    ? `translateZ(${totalZ}px) rotateX(${localTilt.rx}deg) rotateY(${localTilt.ry}deg)${isDragging ? ' scale(1.04)' : ''}`
    : isDragging
      ? 'scale(1.04)'
      : 'none'

  const sheenX = Math.round(localTilt.lx * 100)
  const sheenY = Math.round(localTilt.ly * 100)

  return (
    <div
      className="absolute"
      style={{
        ...style,
        transformStyle: depth3D ? 'preserve-3d' : undefined,
        zIndex: isDragging ? 40 : localTilt.active ? 30 : active ? 20 : 10,
      }}
    >
      {active && (
        <>
          <span
            className="pointer-events-none absolute -inset-2 rounded-2xl"
            style={{
              background: `radial-gradient(closest-side, ${STAGE_HEX[stage.id]}33, transparent 75%)`,
              animation: 'stage-pulse 2.2s ease-in-out infinite',
              transform: depth3D ? `translateZ(${totalZ - 6}px)` : undefined,
            }}
          />
          <style>{`
            @keyframes stage-pulse {
              0%, 100% { opacity: 0.55; transform: scale(1); }
              50%      { opacity: 0.95; transform: scale(1.03); }
            }
          `}</style>
        </>
      )}
      {depth3D && (
        <span
          aria-hidden
          className="pointer-events-none absolute rounded-[50%]"
          style={{
            left: '10%',
            right: '10%',
            bottom: -10,
            height: 14,
            background: 'radial-gradient(closest-side, rgba(15,23,42,0.22), transparent 70%)',
            filter: 'blur(6px)',
            opacity: isDragging ? 0.9 : localTilt.active ? 0.55 : 0.25,
            transform: `translateZ(${-totalZ - 2}px) scale(${1 + liftZ / 80})`,
            transition: 'opacity 160ms ease-out',
          }}
        />
      )}
      <button
        type="button"
        data-stage={stage.id}
        onMouseDown={onDragStart}
        onMouseMove={onMouseMoveCard}
        onMouseLeave={onMouseLeaveCard}
        onClick={onSelect}
        className={`relative w-[170px] shrink-0 rounded-xl border bg-card text-left p-3.5 ${
          active
            ? `border-foreground shadow-lg ring-2 ring-offset-2 ${accent.ring}`
            : 'border-border hover:border-ring'
        } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          transform: tiltStr,
          transformStyle: depth3D ? 'preserve-3d' : undefined,
          transition: isDragging
            ? 'box-shadow 150ms ease-out'
            : 'transform 180ms cubic-bezier(.2,.8,.2,1), box-shadow 220ms ease-out, border-color 180ms ease-out',
          boxShadow: isDragging
            ? '0 30px 60px -18px rgba(15,23,42,0.45), 0 10px 24px -12px rgba(15,23,42,0.25)'
            : localTilt.active
              ? `0 18px 40px -22px rgba(15,23,42,0.35), 0 4px 12px -6px ${STAGE_HEX[stage.id]}33`
              : undefined,
          willChange: depth3D ? 'transform' : undefined,
        }}
      >
        {depth3D && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{
              background: `radial-gradient(180px 120px at ${sheenX}% ${sheenY}%, ${STAGE_HEX[stage.id]}1f, transparent 60%), linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 45%)`,
              opacity: localTilt.active ? 1 : 0.45,
              transition: 'opacity 180ms ease-out',
              mixBlendMode: 'soft-light',
            }}
          />
        )}
        <div className="mb-2 flex items-center justify-between">
          <span className={`font-mono text-[10px] font-semibold tracking-wider ${accent.text}`}>
            {stage.num}
          </span>
          <div className="flex items-center gap-2">
            <span className="h-1 w-4 rounded-full bg-muted" />
            <span className="relative flex h-2 w-2">
              {active && (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${accent.dot}`}
                />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${accent.dot}`} />
            </span>
          </div>
        </div>
        <div className="text-sm font-semibold leading-tight text-foreground">{stage.title}</div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/70">{stage.subtitle}</div>
        <div className="mt-3 border-t border-border pt-3">
          {stage.tools.slice(0, 3).map(t => (
            <div key={t.name} className="truncate font-mono text-[10.5px] leading-relaxed text-muted-foreground">
              · {t.name}
            </div>
          ))}
          {stage.tools.length > 3 && (
            <div className="font-mono text-[10.5px] leading-relaxed text-muted-foreground/70">
              +{stage.tools.length - 3} more
            </div>
          )}
        </div>
      </button>
    </div>
  )
}


// ── Scroll-reveal hook ───────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.12 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

// ── Animated counter ─────────────────────────────────────────────────────────
function Counter({ target, suffix = '', format }: { target: number; suffix?: string; format?: 'comma' }) {
  const [val, setVal] = useState(0)
  const { ref, visible } = useReveal()
  useEffect(() => {
    if (!visible) return
    let start = 0
    const step = Math.ceil(target / 40)
    const t = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(t) } else setVal(start)
    }, 30)
    return () => clearInterval(t)
  }, [visible, target])
  const display = format === 'comma' ? val.toLocaleString('en-US') : val
  return <span ref={ref}>{display}{suffix}</span>
}

// ── Floating orbs for hero ────────────────────────────────────────────────────
// A single, restrained brand-teal wash — one confident accent instead of a
// multi-hue "AI template" blob field.
const ORBS = [
  { w: 420, h: 420, top: '2%',  left: '-6%', color: 'rgba(27,167,167,0.10)', delay: '0s', dur: '18s' },
]

type HeroNode = {
  id: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  r: number
  kind: 'gen' | 'eval' | 'sim' | 'score'
}

type HeroEdge = { a: number; b: number }

// One hue, varied only in the depth-driven opacity applied at render time —
// the network reads as a signal graph, not a rainbow of unrelated categories.
const HERO_NODE_COLOR: Record<HeroNode['kind'], string> = {
  gen: '#1ba7a7',
  eval: '#1ba7a7',
  sim: '#1ba7a7',
  score: '#1ba7a7',
}

function HeroDiscoveryField() {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const [nodes, setNodes] = useState<HeroNode[]>(() => seedHeroNodes())
  const [tick, setTick] = useState(0)
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 })

  const edges = useMemo<HeroEdge[]>(() => buildHeroEdges(nodes), [nodes])

  useEffect(() => {
    const animate = () => {
      setNodes(prev =>
        prev.map(n => {
          let nx = n.x + n.vx
          let ny = n.y + n.vy
          let nz = n.z + n.vz
          let nvx = n.vx
          let nvy = n.vy
          let nvz = n.vz
          if (nx < 0.04 || nx > 0.96) nvx = -n.vx
          if (ny < 0.05 || ny > 0.95) nvy = -n.vy
          if (nz < 0.1 || nz > 1) nvz = -n.vz
          nx = Math.max(0.04, Math.min(0.96, nx))
          ny = Math.max(0.05, Math.min(0.95, ny))
          nz = Math.max(0.1, Math.min(1, nz))
          return { ...n, x: nx, y: ny, z: nz, vx: nvx, vy: nvy, vz: nvz }
        }),
      )
      setTick(t => t + 1)
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      setMouse({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      })
    }
    el.addEventListener('mousemove', onMove)
    return () => el.removeEventListener('mousemove', onMove)
  }, [])

  const width = 1600
  const height = 900
  const parallaxX = (mouse.x - 0.5) * 48
  const parallaxY = (mouse.y - 0.5) * 40
  const tiltX = (mouse.y - 0.5) * 4.8
  const tiltY = (mouse.x - 0.5) * -6.2

  const projected = useMemo(() => {
    return nodes.map(n => {
      const depth = clamp(n.z + 0.08 * Math.sin(tick * 0.018 + n.id), 0.1, 1)
      const scale = 0.68 + depth * 0.64
      return {
        ...n,
        depth,
        x2: ((n.x - 0.5) * scale + 0.5) * width,
        y2: ((n.y - 0.5) * scale + 0.5) * height,
      }
    })
  }, [nodes, tick])

  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 z-[1]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        style={{
          transform: `perspective(1300px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.12)`,
          transformOrigin: '50% 50%',
          opacity: 0.92,
        }}
      >
        <defs>
          <radialGradient id="hero-gen-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1ba7a7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1ba7a7" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hero-eval-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1ba7a7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1ba7a7" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hero-sim-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1ba7a7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1ba7a7" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hero-score-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1ba7a7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1ba7a7" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g transform={`translate(${parallaxX}, ${parallaxY})`}>
          {edges.map((e, i) => {
            const a = projected[e.a]
            const b = projected[e.b]
            const pulse = 0.22 + 0.22 * (0.5 + 0.5 * Math.sin(tick * 0.036 + i))
            const lineDepth = (a.depth + b.depth) / 2
            return (
              <line
                key={`he-${i}`}
                x1={a.x2}
                y1={a.y2}
                x2={b.x2}
                y2={b.y2}
                stroke="#0f172a"
                strokeOpacity={pulse * (0.12 + lineDepth * 0.26)}
                strokeWidth={0.9 + lineDepth * 1.1}
              />
            )
          })}

          {edges.map((e, i) => {
            const a = projected[e.a]
            const b = projected[e.b]
            const t = ((tick * 0.0052 + i * 0.11) % 1 + 1) % 1
            const px = a.x2 + (b.x2 - a.x2) * t
            const py = a.y2 + (b.y2 - a.y2) * t
            const particleDepth = a.depth + (b.depth - a.depth) * t
            return (
              <circle
                key={`hp-${i}`}
                cx={px}
                cy={py}
                r={1.2 + particleDepth * 1.9}
                fill={HERO_NODE_COLOR[a.kind]}
                opacity={0.28 + particleDepth * 0.58 - t * 0.1}
              />
            )
          })}

          {projected.map(n => {
            const gradId = `hero-${n.kind}-grad`
            return (
              <g key={`hn-${n.id}`}>
                <circle cx={n.x2} cy={n.y2} r={n.r * (2.8 + n.depth * 2.4)} fill={`url(#${gradId})`} opacity={0.2 + n.depth * 0.34} />
                <circle
                  cx={n.x2}
                  cy={n.y2}
                  r={n.r * (0.68 + n.depth * 0.72)}
                  fill="#ffffff"
                  stroke={HERO_NODE_COLOR[n.kind]}
                  strokeWidth={1 + n.depth * 1.15}
                  opacity={0.52 + n.depth * 0.56}
                />
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

function seedHeroNodes(): HeroNode[] {
  const kinds: HeroNode['kind'][] = ['gen', 'eval', 'sim', 'score']
  const rng = heroMulberry(77)
  const out: HeroNode[] = []
  for (let i = 0; i < 44; i += 1) {
    const kind = kinds[i % kinds.length]
    out.push({
      id: i,
      x: 0.06 + rng() * 0.88,
      y: 0.08 + rng() * 0.84,
      z: 0.08 + rng() * 0.9,
      vx: (rng() - 0.5) * 0.00145,
      vy: (rng() - 0.5) * 0.00145,
      vz: (rng() - 0.5) * 0.00155,
      r: 3.3 + rng() * 2.3,
      kind,
    })
  }
  return out
}

function buildHeroEdges(nodes: HeroNode[]): HeroEdge[] {
  const out: HeroEdge[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i]
    const dists: Array<{ j: number; d: number }> = []
    for (let j = 0; j < nodes.length; j += 1) {
      if (i === j) continue
      const b = nodes[j]
      const dx = a.x - b.x
      const dy = a.y - b.y
      dists.push({ j, d: Math.hypot(dx, dy) })
    }
    dists.sort((x, y) => x.d - y.d)
    for (let k = 0; k < 2; k += 1) {
      const j = dists[k].j
      if (i < j) out.push({ a: i, b: j })
    }
  }
  return out
}

function heroMulberry(seed: number) {
  let t = seed
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/* ── Live Discovery Loop card (hero right column) ─────────────────────── */

type LoopStation = {
  id: 'design' | 'execute' | 'measure' | 'learn'
  label: string
  sub: string
  detail: string
  progress: number
  accent: {
    dot: string
    tile: string
    bar: string
    text: string
    ring: string
  }
  icon: React.ReactNode
}

function LoopIconMolecule() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="7" r="2" />
      <circle cx="18" cy="7" r="2" />
      <circle cx="12" cy="17" r="2" />
      <path d="M7.5 8.5 L10.5 15.5 M16.5 8.5 L13.5 15.5 M8 7 L16 7" strokeLinecap="round" />
    </svg>
  )
}

function LoopIconRobot() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="9" width="14" height="10" rx="2" />
      <circle cx="9" cy="14" r="1.2" />
      <circle cx="15" cy="14" r="1.2" />
      <path d="M12 9 V5 M12 5 H15" strokeLinecap="round" />
      <circle cx="15.5" cy="5" r="1" />
      <path d="M3 19 H21" strokeLinecap="round" />
    </svg>
  )
}

function LoopIconSpectrum() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 18 L7 10 L10 14 L13 6 L16 13 L20 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 20 H21" strokeLinecap="round" opacity="0.4" />
    </svg>
  )
}

function LoopIconBrain() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 5 a3 3 0 0 0 -3 3 a3 3 0 0 0 -2 5 a3 3 0 0 0 2 4 a3 3 0 0 0 3 2 V5 Z" />
      <path d="M15 5 a3 3 0 0 1 3 3 a3 3 0 0 1 2 5 a3 3 0 0 1 -2 4 a3 3 0 0 1 -3 2 V5 Z" />
      <path d="M9 9 H12 M9 13 H11 M15 9 H12 M15 13 H13" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

function LiveLoopCard() {
  const [iter, setIter] = useState(137)
  const [activeIdx, setActiveIdx] = useState(0)
  const [candidates, setCandidates] = useState(128)
  const [hitRate, setHitRate] = useState(34)

  const stations = useMemo<LoopStation[]>(() => [
    {
      id: 'design',
      label: 'Design',
      sub: 'ProtGPT2 · RFdiffusion',
      detail: `Generated ${candidates} candidates`,
      progress: 82,
      accent: {
        dot: 'bg-[#207976]',
        tile: 'bg-[#207976]/10 border-[#207976]/25 text-[#1c6663]',
        bar: 'bg-[#207976]',
        text: 'text-[#1c6663]',
        ring: 'ring-[#207976]/25',
      },
      icon: <LoopIconMolecule />,
    },
    {
      id: 'execute',
      label: 'Execute',
      sub: 'Lab robot · plate',
      detail: 'Plate GFP11-A4 running',
      progress: 64,
      accent: {
        dot: 'bg-[#3e6798]',
        tile: 'bg-[#3e6798]/10 border-[#3e6798]/25 text-[#33547d]',
        bar: 'bg-[#3e6798]',
        text: 'text-[#33547d]',
        ring: 'ring-[#3e6798]/25',
      },
      icon: <LoopIconRobot />,
    },
    {
      id: 'measure',
      label: 'Measure',
      sub: 'Assay · reader',
      detail: `${hitRate}% binders · quality ↑`,
      progress: 71,
      accent: {
        dot: 'bg-[#a57327]',
        tile: 'bg-[#a57327]/10 border-[#a57327]/25 text-[#8a611f]',
        bar: 'bg-[#a57327]',
        text: 'text-[#8a611f]',
        ring: 'ring-[#a57327]/25',
      },
      icon: <LoopIconSpectrum />,
    },
    {
      id: 'learn',
      label: 'Learn',
      sub: 'Reranker · memory',
      detail: 'Updating scoring model',
      progress: 48,
      accent: {
        dot: 'bg-[#644d89]',
        tile: 'bg-[#644d89]/10 border-[#644d89]/25 text-[#544073]',
        bar: 'bg-[#644d89]',
        text: 'text-[#544073]',
        ring: 'ring-[#644d89]/25',
      },
      icon: <LoopIconBrain />,
    },
  ], [candidates, hitRate])

  useEffect(() => {
    const stationTick = setInterval(() => {
      setActiveIdx(i => (i + 1) % 4)
    }, 1600)
    const iterTick = setInterval(() => {
      setIter(n => n + 1)
      setCandidates(() => 96 + Math.floor(Math.random() * 96))
      setHitRate(h => Math.max(22, Math.min(48, h + (Math.random() > 0.5 ? 1 : -1))))
    }, 6400)
    return () => {
      clearInterval(stationTick)
      clearInterval(iterTick)
    }
  }, [])

  return (
    <div className="relative w-full max-w-[440px] mx-auto lg:mx-0 lg:ml-auto">
      {/* soft glow halo behind card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-[radial-gradient(60%_50%_at_50%_40%,rgba(27,167,167,0.16),transparent_70%),radial-gradient(55%_45%_at_80%_90%,rgba(27,167,167,0.10),transparent_70%)] blur-2xl"
      />

      <div className="relative rounded-2xl border border-border bg-card/92 shadow-[0_40px_100px_-45px_rgba(15,23,42,0.5)] backdrop-blur-sm overflow-hidden">
        {/* subtle grid texture inside card */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35] bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:22px_22px]"
        />

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Discovery Loop · Live
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/70">
            <span>iter</span>
            <span className="text-foreground font-semibold">#{iter}</span>
          </div>
        </div>

        {/* Stations */}
        <div className="relative px-5 py-4">
          {/* Return-loop SVG on the right edge */}
          <svg
            className="pointer-events-none absolute right-1 top-6 bottom-6 w-8"
            viewBox="0 0 32 320"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="llLoop" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#644d89" />
                <stop offset="35%" stopColor="#a57327" />
                <stop offset="70%" stopColor="#3e6798" />
                <stop offset="100%" stopColor="#207976" />
              </linearGradient>
            </defs>
            <path
              d="M 4 310 C 34 310, 34 10, 4 10"
              fill="none"
              stroke="url(#llLoop)"
              strokeWidth="1.4"
              strokeDasharray="4 5"
              opacity="0.55"
            />
            <circle r="3" fill="#1ba7a7">
              <animateMotion dur="4.6s" repeatCount="indefinite" path="M 4 310 C 34 310, 34 10, 4 10" />
            </circle>
          </svg>

          <div className="space-y-2 pr-6">
            {stations.map((s, i) => {
              const isActive = i === activeIdx
              return (
                <div
                  key={s.id}
                  className={`relative flex items-center gap-3 rounded-xl border p-2.5 transition-all duration-500 ${
                    isActive
                      ? `bg-card border-border shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)] ring-2 ${s.accent.ring}`
                      : 'bg-card/60 border-border'
                  }`}
                >
                  <div
                    className={`relative h-10 w-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${s.accent.tile}`}
                  >
                    {s.icon}
                    {isActive && (
                      <span className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${s.accent.dot}`}>
                        <span className={`absolute inline-flex h-full w-full rounded-full ${s.accent.dot} opacity-70 animate-ping`} />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-[13px] font-semibold text-foreground leading-tight">
                        {s.label}
                      </div>
                      <div className={`text-[10px] font-mono truncate ${isActive ? s.accent.text : 'text-muted-foreground/70'}`}>
                        {s.sub}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {s.detail}
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.accent.bar} transition-all duration-700 ease-out`}
                        style={{ width: `${isActive ? s.progress : Math.max(12, s.progress - 40)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer telemetry */}
        <div className="relative grid grid-cols-3 border-t border-border bg-surface/60">
          <div className="px-3 py-3 text-center border-r border-border">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground/70">Candidates</div>
            <div className="text-sm font-mono font-semibold text-foreground mt-0.5">{candidates}</div>
          </div>
          <div className="px-3 py-3 text-center border-r border-border">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground/70">Hit rate</div>
            <div className="text-sm font-mono font-semibold text-[#207976] mt-0.5">{hitRate}%</div>
          </div>
          <div className="px-3 py-3 text-center">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground/70">Turnaround</div>
            <div className="text-sm font-mono font-semibold text-foreground mt-0.5">41m</div>
          </div>
        </div>
      </div>

      {/* Floating chip badges around the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-3 top-8 rounded-full border border-[#3e6798]/30 bg-card/90 px-2.5 py-1 text-[10px] font-mono text-[#33547d] shadow-sm"
        style={{ animation: 'floatY 5s ease-in-out infinite' }}
      >
        pLDDT 0.87
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-2 top-[38%] rounded-full border border-[#207976]/30 bg-card/90 px-2.5 py-1 text-[10px] font-mono text-[#1c6663] shadow-sm"
        style={{ animation: 'floatY 6.2s 0.6s ease-in-out infinite' }}
      >
        plate · 96w
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-2 bottom-14 rounded-full border border-[#a57327]/30 bg-card/90 px-2.5 py-1 text-[10px] font-mono text-[#8a611f] shadow-sm"
        style={{ animation: 'floatY 5.4s 1.1s ease-in-out infinite' }}
      >
        ΔG −9.2 kcal
      </div>
    </div>
  )
}

export function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [toolIdx, setToolIdx] = useState(0)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setToolIdx(i => (i + 1) % TOOLS.length), 1800)
    return () => clearInterval(t)
  }, [])

  const metricsReveal  = useReveal()
  const featuresReveal = useReveal()
  const usecaseReveal  = useReveal()
  const compareReveal  = useReveal()
  const roadmapReveal  = useReveal()
  const faqReveal      = useReveal()
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  const [bookDemoOpen, setBookDemoOpen] = useState(false)

  useEffect(() => {
    if (!bookDemoOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBookDemoOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = original
      window.removeEventListener('keydown', onKey)
    }
  }, [bookDemoOpen])

  return (
    <div className="landing-page bg-card text-foreground font-sans overflow-x-hidden">

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      {/* ── Global keyframe styles ───────────────────────────────────────── */}
      <style>{`
        .font-sans, body { font-family: 'Inter', system-ui, sans-serif; }
        @keyframes floatY {
          0%,100% { transform: translateY(0px) scale(1); }
          50%      { transform: translateY(-28px) scale(1.03); }
        }
        @keyframes floatX {
          0%,100% { transform: translateX(0px); }
          50%      { transform: translateX(18px); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(0.9); opacity: 0.7; }
          70%  { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes gradient-x {
          0%,100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes typewriter-blink {
          0%,100% { opacity: 1; }
          50%     { opacity: 0; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes count-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer-line {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .reveal-card {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .reveal-card.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .hero-animate {
          animation: slide-up 0.8s cubic-bezier(0.16,1,0.3,1) both;
        }
        .gradient-text-anim {
          background-size: 200% 200%;
          animation: gradient-x 4s ease infinite;
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee 28s linear infinite;
        }
        .marquee-track:hover { animation-play-state: paused; }
      `}</style>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-8 h-16 transition-all duration-500 ${scrolled ? 'bg-card/90 backdrop-blur-md border-b border-border shadow-sm' : ''}`}>
        <a href="#" className="no-underline" style={{ animation: 'fade-in 0.6s ease both' }}>
          <Logo size="md" />
        </a>
        <div className="hidden md:flex items-center rounded-full border border-border bg-card/80 backdrop-blur px-1.5 py-1 shadow-sm">
          {NAV_LINKS.map((l, i) => (
            <a
              key={i}
              href={l.href}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full hover:bg-muted transition-all"
              style={{ animation: `fade-in 0.6s ${0.1 * i}s ease both` }}
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2" style={{ animation: 'fade-in 0.6s 0.3s ease both' }}>
          <a href={SIGN_IN_HREF} className="hidden sm:inline text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors">Sign In</a>
          <button
            type="button"
            onClick={() => setBookDemoOpen(true)}
            className="text-xs font-semibold px-4 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary-hover transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          >
            Book a demo
          </button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-center px-6 pt-28 pb-20 overflow-hidden bg-surface">
        {/* Animated grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <HeroDiscoveryField />
        <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.05),rgba(248,250,252,0.55)_58%,rgba(248,250,252,0.8)_100%)]" />
        <div className="pointer-events-none absolute inset-0 z-[3] bg-[radial-gradient(42%_36%_at_14%_20%,rgba(27,167,167,0.14),transparent_74%)]" />

        {/* Floating orbs */}
        {ORBS.map((o, i) => (
          <div key={i} className="absolute rounded-full pointer-events-none"
            style={{
              width: o.w, height: o.h, top: o.top, left: o.left,
              background: `radial-gradient(circle, ${o.color}, transparent 70%)`,
              animation: `${i % 2 === 0 ? 'floatY' : 'floatX'} ${o.dur} ${o.delay} ease-in-out infinite`,
            }} />
        ))}

        {/* Asymmetric split: copy left, live loop card right */}
        <div className="relative z-10 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-16 items-center">
          {/* Left column — copy */}
          <div className="relative text-center lg:text-left">
            {/* subtle readability halo behind text */}
            <div className="pointer-events-none absolute -inset-x-6 -inset-y-8 rounded-[2rem] bg-[radial-gradient(60%_50%_at_20%_50%,rgba(255,255,255,0.6),rgba(255,255,255,0.12)_70%,transparent)] lg:bg-[radial-gradient(55%_50%_at_10%_50%,rgba(255,255,255,0.55),transparent_75%)]" />
            <div className="relative">
              {/* Badge */}
              <div className="hero-animate inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary/[0.06] text-primary text-[11px] font-semibold tracking-widest mb-7"
                style={{ animationDelay: '0s' }}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                DIGITAL + PHYSICAL DISCOVERY LOOP
              </div>

              {/* Headline */}
              <h1 className="hero-animate text-[2.75rem] sm:text-6xl lg:text-[4.4rem] tracking-tight leading-[1.02] text-foreground mb-5"
                style={{ animationDelay: '0.1s' }}>
                <span className="font-semibold">The operating system for</span>
                <br />
                <span className="font-bold text-primary">
                  AI-driven, real-world discovery
                </span>
              </h1>

              {/* Body */}
              <p className="hero-animate text-base sm:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-5 leading-relaxed"
                style={{ animationDelay: '0.2s' }}>
                Every experiment is signal. SynqLab connects generative models,
                structure predictors, and your lab systems into one self-improving loop —
                from simulation to robots and instruments.
              </p>

              {/* Bridge chips */}
              <div className="hero-animate mb-6 max-w-xl mx-auto lg:mx-0 rounded-xl border border-white/60 bg-card/70 px-3 py-2.5 shadow-[0_12px_40px_-26px_rgba(15,23,42,0.45)] backdrop-blur-[1.8px]"
                style={{ animationDelay: '0.28s' }}>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 text-[11px] font-mono text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.05] px-2.5 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                    in-silico design
                  </span>
                  <span className="text-muted-foreground/50">→</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.08] px-2.5 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/75" />
                    robotic execution
                  </span>
                  <span className="text-muted-foreground/50">→</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    instrument feedback
                  </span>
                </div>
              </div>

              {/* Ticker */}
              <p className="hero-animate text-xs text-muted-foreground/70 mb-7 h-5" style={{ animationDelay: '0.3s' }}>
                Running{' '}
                <span key={toolIdx} className="text-primary font-semibold font-mono"
                  style={{ animation: 'slide-up 0.35s ease both' }}>
                  {TOOLS[toolIdx]}
                </span>
                {' '}and {TOOLS.length - 1} more tools
              </p>

              {/* CTAs */}
              <div className="hero-animate flex gap-3 justify-center lg:justify-start flex-wrap" style={{ animationDelay: '0.4s' }}>
                <button
                  type="button"
                  onClick={() => setBookDemoOpen(true)}
                  className="text-sm font-semibold px-6 py-2.5 bg-foreground text-white rounded-md transition-all duration-200 hover:bg-foreground/80 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 shadow-sm">
                  Book a demo
                </button>
                <a href="#architecture"
                  className="text-sm font-medium px-6 py-2.5 border border-border text-muted-foreground rounded-md hover:border-primary/40 hover:text-primary transition-all duration-200 bg-card hover:shadow-md hover:-translate-y-0.5">
                  See the architecture ↓
                </a>
              </div>
            </div>
          </div>

          {/* Right column — Live Loop card */}
          <div className="hero-animate relative" style={{ animationDelay: '0.35s' }}>
            <LiveLoopCard />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 opacity-40"
          style={{ animation: 'fade-in 1s 1.2s ease both' }}>
          <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Scroll</span>
          <div className="w-5 h-8 rounded-full border border-ring flex items-start justify-center pt-1.5">
            <div className="w-1 h-1.5 rounded-full bg-surface0" style={{ animation: 'floatY 1.6s ease-in-out infinite' }} />
          </div>
        </div>
      </section>

      {/* ── Proof strip — one honest evidence band, real numbers not logos ── */}
      <div ref={metricsReveal.ref} className="bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-muted-foreground/70 uppercase text-center mb-8">
            Evidence, not slideware — we're pre-pilot and showing our actual numbers
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {PROOF_POINTS.map((p, i) => (
              <div key={p.label}
                className="text-center"
                style={metricsReveal.visible ? { animation: `slide-up 0.5s ${i * 0.1}s ease both` } : { opacity: 0 }}>
                <div className="font-mono text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                  {metricsReveal.visible && p.count != null ? <Counter target={p.count} format={p.format} /> : p.value}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Marquee tool strip ──────────────────────────────────────────── */}
      <div className="py-5 overflow-hidden border-b border-border bg-surface">
        <div className="marquee-track">
          {[...TOOLS, ...TOOLS].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-2 mx-4 text-[11px] font-mono font-medium text-muted-foreground/70">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40 inline-block" />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* ── Platform features ───────────────────────────────────────────── */}
      <section id="platform" className="py-24 px-6 max-w-6xl mx-auto">
        <div ref={featuresReveal.ref} className="text-center mb-16"
          style={featuresReveal.visible ? { animation: 'slide-up 0.6s ease both' } : { opacity: 0 }}>
          <p className="text-[11px] font-semibold tracking-widest text-primary mb-3 uppercase">Platform</p>
          <h2 className="text-3xl sm:text-5xl tracking-tight text-foreground mb-4">
            <span className="font-semibold">Built for </span>
            <span className="font-bold text-primary">iterative design</span>
            <span className="font-semibold"> at every scale</span>
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            From a single laptop to a robotic lab stack — SynqLab adapts to your compute, your instruments, and your discovery goals.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-x divide-y divide-border border border-border rounded-xl overflow-hidden">
          {FEATURES.map((f, i) => (
            <div key={i}
              className="p-8 bg-card hover:bg-surface transition-all duration-300 group hover:-translate-y-0.5 hover:shadow-md cursor-default"
              style={featuresReveal.visible ? { animation: `slide-up 0.5s ${0.07 * i}s ease both` } : { opacity: 0 }}>
              <div className="w-10 h-10 rounded-lg border border-border bg-card flex items-center justify-center text-foreground/80 text-lg mb-5 group-hover:border-primary/30 group-hover:bg-primary/[0.06] group-hover:text-primary transition-all duration-300">
                {f.icon}
              </div>
              <div className="text-sm font-semibold text-foreground mb-2">{f.title}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Architecture diagram ─────────────────────────────────────────── */}
      <section id="architecture" className="py-24 px-6 bg-surface border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14" style={{ animation: 'slide-up 0.6s ease both' }}>
            <p className="text-[11px] font-semibold tracking-widest text-primary mb-3 uppercase">Discovery Cycle</p>
            <h2 className="text-3xl sm:text-5xl tracking-tight text-foreground mb-4">
              <span className="font-semibold">How a candidate becomes a </span>
              <span className="font-bold text-primary">drug lead</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Every compound enters a library, gets virtually screened, simulated, measured in an assay, and the
              model learns from the readout — then the next round can launch in software or in connected lab automation.
              Switch to <span className="font-semibold text-foreground/80">3D · Space</span> to orbit the cycle and click any compound orb to focus on that stage.
            </p>
          </div>
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden p-5 sm:p-6"
            style={{ animation: 'slide-up 0.7s 0.15s ease both' }}>
            <ArchitectureViewer />
          </div>
        </div>
      </section>

      {/* ── Use cases ───────────────────────────────────────────────────── */}
      <section id="use-cases" className="py-24 px-6 bg-card">
        <div className="max-w-5xl mx-auto">
          <div ref={usecaseReveal.ref} className="text-center mb-16"
            style={usecaseReveal.visible ? { animation: 'slide-up 0.6s ease both' } : { opacity: 0 }}>
            <p className="text-[11px] font-semibold tracking-widest text-primary mb-3 uppercase">Use Cases</p>
            <h2 className="text-3xl sm:text-5xl tracking-tight text-foreground">
              <span className="font-semibold">One platform. </span>
              <span className="font-bold text-primary">Every design problem.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {USE_CASES.map((u, i) => (
              <div key={i}
                className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-300 group cursor-default hover:-translate-y-1"
                style={usecaseReveal.visible ? { animation: `slide-up 0.5s ${0.1 * i}s ease both` } : { opacity: 0 }}>
                <span className="text-[10px] font-semibold tracking-widest text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded uppercase">
                  {u.tag}
                </span>
                <h3 className="text-sm font-semibold text-foreground mt-4 mb-2 group-hover:text-primary transition-colors">{u.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{u.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compare ─────────────────────────────────────────────────────── */}
      <section id="compare" className="py-24 px-6 bg-surface border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div ref={compareReveal.ref} className="text-center mb-14"
            style={compareReveal.visible ? { animation: 'slide-up 0.6s ease both' } : { opacity: 0 }}>
            <p className="text-[11px] font-semibold tracking-widest text-primary mb-3 uppercase">Compare</p>
            <h2 className="text-3xl sm:text-5xl tracking-tight text-foreground mb-4">
              <span className="font-semibold">Why teams move from </span>
              <span className="font-bold text-primary">scripts</span>
              <span className="font-semibold"> to SynqLab</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              An honest side-by-side. No benchmarks lifted from a paper — just what actually changes when a discovery loop becomes first-class infrastructure.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            style={compareReveal.visible ? { animation: 'slide-up 0.6s 0.15s ease both' } : { opacity: 0 }}>
            <div className="grid grid-cols-12 bg-surface border-b border-border text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              <div className="col-span-4 px-6 py-4">Dimension</div>
              <div className="col-span-4 px-6 py-4 border-l border-border">Status quo</div>
              <div className="col-span-4 px-6 py-4 border-l border-border bg-primary/10 text-primary">With SynqLab</div>
            </div>
            {COMPARISON.map((row, i) => (
              <div key={row.dimension}
                className={`grid grid-cols-12 text-sm ${i < COMPARISON.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="col-span-4 px-6 py-5 font-semibold text-foreground">{row.dimension}</div>
                <div className="col-span-4 px-6 py-5 border-l border-border text-muted-foreground">{row.status_quo}</div>
                <div className="col-span-4 px-6 py-5 border-l border-border bg-primary/[0.04] text-foreground">
                  <span className="inline-flex items-start gap-2">
                    <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span>{row.synqlab}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roadmap ─────────────────────────────────────────────────────── */}
      <section id="roadmap" className="py-24 px-6 bg-surface border-y border-border">
        <div className="max-w-2xl mx-auto">
          <div ref={roadmapReveal.ref} className="text-center mb-16"
            style={roadmapReveal.visible ? { animation: 'slide-up 0.6s ease both' } : { opacity: 0 }}>
            <p className="text-[11px] font-semibold tracking-widest text-primary mb-3 uppercase">Roadmap</p>
            <h2 className="text-3xl sm:text-5xl tracking-tight text-foreground">
              <span className="font-semibold">Building toward </span>
              <span className="font-bold text-primary">fully autonomous discovery</span>
            </h2>
          </div>

          <div className="space-y-3">
            {ROADMAP.map((r, i) => (
              <div key={i}
                className={`flex overflow-hidden rounded-xl border transition-all duration-300 hover:shadow-md ${r.active ? 'border-slate-800 bg-foreground hover:border-primary/60' : 'border-border bg-card opacity-60 hover:opacity-80'}`}
                style={roadmapReveal.visible ? { animation: `slide-in-left 0.5s ${0.1 * i}s ease both` } : { opacity: 0 }}>
                <div className={`w-1 shrink-0 ${r.active ? 'bg-gradient-to-b from-primary/70 to-primary' : 'bg-muted'}`} />
                <div className="px-6 py-5 flex-1">
                  <div className={`text-[10px] font-semibold tracking-widest uppercase mb-1.5 ${r.active ? 'text-primary' : 'text-muted-foreground/70'}`}>{r.phase}</div>
                  <div className={`text-sm font-semibold mb-1 ${r.active ? 'text-white' : 'text-foreground/80'}`}>{r.title}</div>
                  <div className={`text-xs leading-relaxed ${r.active ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>{r.desc}</div>
                </div>
                {r.active && (
                  <div className="px-4 flex items-center">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-primary bg-primary/15 border border-primary/30 px-2 py-1 rounded">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                      LIVE
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-6 bg-card">
        <div className="max-w-4xl mx-auto">
          <div ref={faqReveal.ref} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4"
              style={faqReveal.visible ? { animation: 'slide-up 0.6s ease both' } : { opacity: 0 }}>
              <p className="text-[11px] font-semibold tracking-widest text-primary mb-3 uppercase">FAQ</p>
              <h2 className="text-3xl sm:text-4xl tracking-tight text-foreground leading-tight">
                <span className="font-semibold">Questions, </span>
                <span className="font-bold text-primary">answered.</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
                Not here? Email <a href="mailto:hello@synqlab.ai" className="text-foreground underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900">hello@synqlab.ai</a> — we reply within a business day.
              </p>
            </div>
            <div className="lg:col-span-8 divide-y divide-border border-t border-border"
              style={faqReveal.visible ? { animation: 'slide-up 0.6s 0.1s ease both' } : { opacity: 0 }}>
              {FAQ.map((item, i) => {
                const open = faqOpen === i
                return (
                  <div key={item.q} className="py-5">
                    <button
                      onClick={() => setFaqOpen(open ? null : i)}
                      className="w-full flex items-start justify-between gap-6 text-left group">
                      <span className={`text-[15px] font-semibold transition-colors ${open ? 'text-foreground' : 'text-foreground/80 group-hover:text-foreground'}`}>
                        {item.q}
                      </span>
                      <span className={`mt-1 shrink-0 flex items-center justify-center w-6 h-6 rounded-full border transition-all ${open ? 'border-foreground bg-foreground text-white rotate-45' : 'border-border text-muted-foreground/70 group-hover:border-foreground group-hover:text-foreground'}`}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      </span>
                    </button>
                    <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <p className="text-sm text-muted-foreground leading-relaxed pr-10">{item.a}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>



      {/* ── Contact ─────────────────────────────────────────────────────── */}
      <section id="contact" className="py-24 px-6 bg-card">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          <div className="md:col-span-7 rounded-2xl border border-border bg-card p-8">
            <p className="text-[11px] font-semibold tracking-widest text-primary mb-3 uppercase">Contact</p>
            <h2 className="text-3xl sm:text-4xl tracking-tight text-foreground mb-4">
              <span className="font-semibold">Talk to the </span>
              <span className="font-bold text-primary">SynqLab team</span>
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mb-6">
              Share your target, assay type, and current bottlenecks. We'll propose a practical pipeline for your discovery program and walk through it live.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setBookDemoOpen(true)}
                className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 bg-foreground text-white rounded-md hover:bg-foreground/80 transition-all"
              >
                Book a demo <span aria-hidden>→</span>
              </button>
              <a
                href="mailto:hello@synqlab.ai"
                className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 border border-border text-foreground/80 rounded-md hover:border-primary/40 hover:text-primary transition-all"
              >
                Email us instead
              </a>
            </div>
          </div>

          <div className="md:col-span-5 rounded-2xl border border-border bg-surface p-8">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-4">What to include</p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>• Therapeutic area or protein family</li>
              <li>• Assay readout (binding, brightness, activity, etc.)</li>
              <li>• Throughput and compute constraints</li>
              <li>• Team size and collaboration needs</li>
            </ul>
            <div className="mt-6 pt-5 border-t border-border text-xs text-muted-foreground leading-relaxed">
              Typical response time: <span className="font-semibold text-foreground/80">within 1 business day</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-foreground text-white">
        <div className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            background: 'radial-gradient(600px 300px at 20% 30%, rgba(27,167,167,0.18), transparent 60%), radial-gradient(500px 250px at 80% 70%, rgba(27,167,167,0.10), transparent 60%)',
          }} />
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-28 grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-8">
            <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-primary/80 mb-4">Get started</p>
            <h2 className="text-4xl sm:text-5xl tracking-tight leading-[1.05] mb-5"
              style={{ animation: 'slide-up 0.6s ease both' }}>
              <span className="font-semibold">Ready to see it </span>
              <span className="font-bold text-white">in action?</span>
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground/50 max-w-xl leading-relaxed"
              style={{ animation: 'slide-up 0.6s 0.1s ease both' }}>
              We onboard a small number of teams each quarter. Request a 30-minute demo and we'll walk you through the full pipeline with your use case — no slides, live system.
            </p>
          </div>
          <div className="md:col-span-4 flex md:justify-end"
            style={{ animation: 'slide-up 0.6s 0.2s ease both' }}>
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setBookDemoOpen(true)}
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-7 py-3.5 bg-card text-foreground rounded-md hover:bg-primary/10 transition-all duration-200 shadow-lg shadow-black/30 hover:-translate-y-0.5">
                Request a demo
                <span aria-hidden>→</span>
              </button>
              <a
                href="mailto:hello@synqlab.ai"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium px-7 py-3.5 border border-white/20 rounded-md text-muted-foreground/40 hover:bg-card/5 hover:border-white/40 transition-all">
                Email us instead
              </a>
            </div>
          </div>
        </div>
      </section>


      {bookDemoOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            aria-label="Close booking"
            onClick={() => setBookDemoOpen(false)}
            className="absolute inset-0 bg-foreground/52 backdrop-blur-[2px]"
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Book a demo"
            className="relative z-10 w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-card shadow-[0_35px_120px_-40px_rgba(15,23,42,0.55)]"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12">
              <div className="relative lg:col-span-4 border-b lg:border-b-0 lg:border-r border-border bg-[radial-gradient(circle_at_20%_20%,rgba(27,167,167,0.12),transparent_50%),linear-gradient(to_bottom_right,#f8fafc,#f1f5f9)] p-5 sm:p-6">
                <button
                  type="button"
                  onClick={() => setBookDemoOpen(false)}
                  className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground hover:border-foreground hover:text-foreground"
                >
                  <span aria-hidden>×</span>
                </button>

                <div className="pr-10">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">Book a demo</div>
                  <h3 className="mt-2 text-xl font-semibold text-foreground leading-tight">See SynqLab with your own discovery workflow</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Pick a slot and we will send the calendar invite automatically.
                  </p>
                </div>

                <div className="mt-5 space-y-2 text-[12px] text-muted-foreground">
                  <div className="inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1 border border-border">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" /> 30-minute live walkthrough
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1 border border-border">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/70" /> Pipeline + lab integration fit
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1 border border-border">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/40" /> Q&A with the team
                  </div>
                </div>

                <div className="mt-5 text-[11px] text-muted-foreground leading-relaxed">
                  If booking does not load, open in a new tab:{' '}
                  <a href={DEMO_BOOKING_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:text-primary/80">
                    booking link
                  </a>
                </div>
              </div>

              <div className="lg:col-span-8 bg-card">
                <div className="h-[72vh] min-h-[560px] max-h-[760px] w-full">
                  <iframe
                    title="SynqLab demo booking"
                    src={DEMO_BOOKING_URL}
                    className="h-full w-full"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-8 py-16 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-10">
          <div className="col-span-2 lg:col-span-2">
            <div className="mb-4">
              <Logo size="md" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mb-5">
              The operating system for AI-driven discovery.
              Close the loop between generation, evaluation, and experiment.
            </p>
            <button
              type="button"
              onClick={() => setBookDemoOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors"
            >
              Book a demo <span aria-hidden>→</span>
            </button>
          </div>
          {[
            { title: 'Product', links: [
              { label: 'Platform', href: '#platform' },
              { label: 'Architecture', href: '#architecture' },
              { label: 'Use cases', href: '#use-cases' },
              { label: 'Roadmap', href: '#roadmap' },
            ]},
            { title: 'Resources', links: [
              { label: 'FAQ', href: '#faq' },
              { label: 'Compare', href: '#compare' },
              { label: 'Docs', href: '#' },
              { label: 'Research notes', href: '#' },
            ]},
            { title: 'Company', links: [
              { label: 'Book a demo', href: '#book-demo' },
              { label: 'Contact us', href: '#book-demo' },
              { label: 'Privacy', href: '#' },
              { label: 'Security', href: '#' },
            ]},
          ].map(col => (
            <div key={col.title}>
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((l, li) => (
                  <li key={li}>
                    <a
                      href={l.href}
                      onClick={l.href === '#book-demo' ? (e) => { e.preventDefault(); setBookDemoOpen(true) } : undefined}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <div className="max-w-6xl mx-auto px-8 py-5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground/70">© 2026 SynqLab. All rights reserved.</span>
            <span className="text-[11px] text-muted-foreground/70 font-mono">Made for scientists who ship.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
