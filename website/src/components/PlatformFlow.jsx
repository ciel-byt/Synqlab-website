import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Upload, Cpu, Dna, BookOpen, FileText, BarChart3, FlaskConical, Box, CircleCheck, AlignLeft, Terminal, Sparkles, Puzzle, Activity, Server, Zap, Wallet, Bell, Layers, Monitor, Droplet } from "lucide-react";
import { NODES } from "./platformNodes.js";

// Animated, clickable SynqLab architecture, top to bottom. Everything is always visible and readable;
// the animation shows what is working (moving dots, brand-colored icons). Click a node for details on the right.
// Source: platform architecture doc (2026-05-24). Text for each node lives in platformNodes.js.

const STEPS = [
  { t: "Goal", d: "A team starts with a goal and data: text, sequences, structures, assays.", node: "goal" },
  { t: "Plan", d: "The SynqLab agent plans, writes code, submits jobs and decides what to do next.", node: "agent" },
  { t: "Delegate", d: "It calls specialist agents and tools, and runs on compute with budgets and approvals.", node: "structure" },
  { t: "Record", d: "Every action is written to the knowledge store: versioned, with a signed audit log.", node: "store" },
  { t: "Results", d: "Candidates come back scored in silico. Lab results join them later.", node: "insilico" },
  { t: "Learn", d: "What was learned goes back to the agent, so the next round starts smarter.", node: "agent" },
];

const ICONS = { goal: Upload, aria: Dna, literature: BookOpen, reports: FileText, data: BarChart3, lab: FlaskConical, structure: Box, scoring: CircleCheck, design: Sparkles, docking: Puzzle, dynamics: Activity, seqdb: AlignLeft, code: Terminal, scheduler: Server, gpu: Zap, budget: Wallet, notify: Bell, store: Layers, insilico: Monitor, invitro: Droplet };

const CX = 459;
const X0 = [24, 334, 644];
const TX = X0.map((x) => x + 125);
const Y_AGENT = 235;
const Y_HEAD = 325;
const Y0 = 372;
const ROW = 62;
const Y_STORE = 770;
const Y_OUT = 935;

const COLUMNS = [
  { head: "SPECIALIST AGENTS", items: [["aria", "Protein design"], ["literature", "Search and synthesis"], ["reports", "Deep research"], ["data", "Tables and plots"], ["lab", "In vitro"]] },
  { head: "DIRECT TOOLS", items: [["structure", "AlphaFold · Boltz · Chai-1"], ["design", "RFdiffusion · ProteinMPNN"], ["docking", "DiffDock · AutoDock Vina"], ["dynamics", "GROMACS"], ["scoring", "pLDDT · ipTM · Rosetta"], ["seqdb", "MMseqs2 · InterPro"]] },
  { head: "COMPUTE AND OPS", items: [["scheduler", "HPC and cloud"], ["gpu", "Cloud GPUs"], ["code", "Python · bash"], ["budget", "Spend limits"], ["notify", "Alerts and handoff"]] },
];

const curve = (x1, y1, x2, y2) => `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2 + 10}, ${x2} ${(y1 + y2) / 2 - 10}, ${x2} ${y2}`;
const PATHS = {
  goal: `M ${CX} 130 L ${CX} ${Y_AGENT - 50}`,
  d: TX.map((x) => curve(CX, Y_AGENT + 36, x, Y_HEAD - 24)),
  r: TX.map((x, i) => curve(x, [708, 708, 646][i], CX, Y_STORE - 30)),
  o: [curve(CX - 60, 868, CX - 190, Y_OUT - 28), curve(CX + 60, 868, CX + 190, Y_OUT - 28)],
  loop: `M 690 ${Y_STORE + 20} C 1040 ${Y_STORE + 20}, 1040 ${Y_AGENT}, ${CX + 46} ${Y_AGENT}`,
};

function Flow({ d, on, count = 3, dur = 2.8, dashed }) {
  return (
    <g>
      <path d={d} className={`vz-line${on ? " on" : ""}${dashed ? " dashed" : ""}`} />
      {on && Array.from({ length: count }).map((_, i) => (
        <circle key={i} r="4" className="vz-dot">
          <animateMotion dur={`${dur}s`} begin={`${((i * dur) / count).toFixed(2)}s`} repeatCount="indefinite" path={d} />
        </circle>
      ))}
    </g>
  );
}

// Icon in a ring, then a name and a sub line. Clickable. `hot` = active in the tour; `sel` = chosen by the visitor.
function Node({ id, x, y, sub, hot, sel, delay = 0, stack, big, pick }) {
  const Icon = ICONS[id];
  const name = NODES[id].name;
  const act = (e) => { if (e.type === "click" || e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(id); } };
  const cls = `vz-node vz-click${hot || sel ? " hot" : ""}${sel ? " sel" : ""}`;
  const aria = { role: "button", tabIndex: 0, "aria-label": `${name}: details`, "aria-pressed": !!sel, onClick: act, onKeyDown: act };
  const style = { transitionDelay: hot ? `${delay}ms` : "0ms" };
  if (stack) {
    return (
      <g className={cls} style={style} {...aria}>
        <rect x={x - 150} y={y - 30} width="300" height="122" rx="12" className="vz-hit" />
        <circle cx={x} cy={y} r="22" className="vz-ring-i" />
        <Icon x={x - 12} y={y - 12} width="24" height="24" strokeWidth="1.6" className="vz-ico" />
        <text x={x} y={y + 52} textAnchor="middle" className={big ? "vz-big" : "vz-name"}>{name}</text>
        {sub.map((s, i) => <text key={s} x={x} y={y + 73 + i * 17} textAnchor="middle" className="vz-sub">{s}</text>)}
      </g>
    );
  }
  return (
    <g className={cls} style={style} {...aria}>
      <rect x={x - 10} y={y - 28} width="248" height="56" rx="10" className="vz-hit" />
      <circle cx={x + 18} cy={y} r="19" className="vz-ring-i" />
      <Icon x={x + 6} y={y - 12} width="24" height="24" strokeWidth="1.6" className="vz-ico" />
      <text x={x + 46} y={y - 2} className="vz-name">{name}</text>
      <text x={x + 46} y={y + 16} className="vz-sub">{sub}</text>
    </g>
  );
}

function Panel({ id, touring, onTour }) {
  const n = NODES[id];
  const Icon = id === "agent" ? Cpu : ICONS[id];
  return (
    <aside className="vz-panel" aria-live="polite">
      <div key={id} className="vz-panel-in">
        <div className="vz-panel-top">
          <span className="vz-panel-ico"><Icon size={22} strokeWidth={1.6} /></span>
          {!touring && <button className="vz-back" onClick={onTour}>Back to the tour</button>}
        </div>
        <h3>{n.name}</h3>
        {n.status && <p className="vz-status">{n.status}</p>}
        <p className="vz-what">{n.what}</p>
        <ul>{n.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
        {n.note && <p className="vz-note">{n.note}</p>}
        {n.engines && (
          <div className="vz-eng">
            <span className="mono">Engines</span>
            <div>{n.engines.map((e) => <span key={e}>{e}</span>)}</div>
          </div>
        )}
        {n.to && <Link to={n.to} className="go">Open {n.name} →</Link>}
      </div>
    </aside>
  );
}

export default function PlatformFlow() {
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState(null);
  const [manual, setManual] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => { setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  useEffect(() => {
    if (manual || still || sel) return;
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 3800);
    return () => clearInterval(id);
  }, [manual, still, sel]);
  useEffect(() => {
    if (!manual) return;
    const id = setTimeout(() => setManual(false), 12000);
    return () => clearTimeout(id);
  }, [manual, step]);

  const on = (...s) => !still && s.includes(step);
  const pick = (id) => setSel(id);
  const panelId = sel || STEPS[step].node;
  const ph = (id) => ({ id, sel: sel === id, pick });

  return (
    <div className="vz">
      <div className="vz-wrap">
        <div className="vz-scroll">
          <svg viewBox="0 0 1010 1060" role="group" aria-label="SynqLab architecture. Select a part for details.">
            <Flow d={PATHS.goal} on={on(0)} count={3} dur={2.2} />
            {PATHS.d.map((d, i) => <Flow key={i} d={d} on={on(2)} />)}
            {PATHS.r.map((d, i) => <Flow key={i} d={d} on={on(3)} />)}
            {PATHS.o.map((d, i) => <Flow key={i} d={d} on={on(4)} />)}
            <Flow d={PATHS.loop} on={on(5)} count={6} dur={5} dashed />

            <Node {...ph("goal")} x={CX} y={52} sub={["Text · sequences · structures · assays"]} stack big hot={on(0)} />

            <g className={`vz-node vz-click${on(1, 2, 5) || sel === "agent" ? " hot" : ""}${sel === "agent" ? " sel" : ""}`} role="button" tabIndex={0} aria-label="SynqLab agent: details" aria-pressed={sel === "agent"}
               onClick={() => pick("agent")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick("agent"); } }}>
              <rect x={CX - 330} y={Y_AGENT - 52} width="420" height="104" rx="14" className="vz-hit" />
              <circle cx={CX} cy={Y_AGENT} r="44" className="vz-ring r1" />
              <circle cx={CX} cy={Y_AGENT} r="44" className="vz-ring r2" />
              <circle cx={CX} cy={Y_AGENT} r="30" className="vz-ring-i" />
              <Cpu x={CX - 15} y={Y_AGENT - 15} width="30" height="30" strokeWidth="1.5" className="vz-ico" />
              <text x={CX - 62} y={Y_AGENT - 4} textAnchor="end" className="vz-big">SynqLab agent</text>
              <text x={CX - 62} y={Y_AGENT + 18} textAnchor="end" className="vz-sub">Plan · code · call agents · learn</text>
            </g>

            {[1, 2].map((i) => <line key={i} x1={X0[i] - 30} x2={X0[i] - 30} y1={Y_HEAD - 14} y2={Y0 + 5 * ROW + 28} className="vz-div" />)}

            {COLUMNS.map((c, ci) => (
              <g key={c.head}>
                <text x={X0[ci]} y={Y_HEAD} className={`vz-head${on(2) ? " hot" : ""}`}>{c.head}</text>
                <line x1={X0[ci]} x2={X0[ci] + 250} y1={Y_HEAD + 14} y2={Y_HEAD + 14} className="vz-rule" />
                {c.items.map(([id, sub], ri) => (
                  <Node key={id} {...ph(id)} x={X0[ci]} y={Y0 + ri * ROW} sub={sub} hot={on(2)} delay={(ri * 3 + ci) * 110} />
                ))}
              </g>
            ))}

            <Node {...ph("store")} x={CX} y={Y_STORE} sub={["Project memory · versioned · traceable", "Signed, append-only audit log"]} stack big hot={on(3)} />
            <Node {...ph("insilico")} x={CX - 190} y={Y_OUT} sub={["Candidates · pLDDT · ipTM · novelty"]} stack hot={on(4)} />
            <Node {...ph("invitro")} x={CX + 190} y={Y_OUT} sub={["Assays · SPR · HPLC · viability"]} stack hot={on(4)} />

            <text x="985" y="560" transform="rotate(90 985 560)" textAnchor="middle" className={`vz-head${on(5) ? " hot" : ""}`}>CLOSED LEARNING LOOP</text>
          </svg>
        </div>
        <Panel id={panelId} touring={!sel} onTour={() => setSel(null)} />
      </div>

      <div className="vz-steps" role="tablist" aria-label="Steps">
        {STEPS.map((s, i) => (
          <button key={s.t} role="tab" aria-selected={step === i} className={`vz-step${step === i ? " on" : ""}`} onClick={() => { setSel(null); setStep(i); setManual(true); }}>
            <span>{String(i + 1).padStart(2, "0")}</span>{s.t}
          </button>
        ))}
      </div>
      <p className="vz-caption" key={step} aria-live="polite">{STEPS[step].d}</p>
    </div>
  );
}
