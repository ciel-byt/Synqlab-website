import { useEffect, useState } from "react";

// A project's life inside SynqLab, day 0 to submission. Milestones light up in turn and their records land beside them.
// Illustrative. Items not built yet are marked planned.
const MILES = [
  { t: "Day 0", d: "Project opens inside your organization", docs: ["Target brief", "Team and roles"] },
  { t: "Data", d: "Data and prior work come in, versioned", docs: ["Dataset v1", "Literature notes"] },
  { t: "Design rounds", d: "Agents design and score. Spend needs approval", docs: ["Round report", "Budget approval"] },
  { t: "Selection", d: "The team reviews candidates and decides", docs: ["Ranked candidates", "Decision log"] },
  { t: "Lab validation", d: "Samples and assays come back in", docs: ["Assay results"], planned: true },
  { t: "Submission", d: "A complete, traceable record to hand over", docs: ["Signed audit log", "Full report"], planned: true },
];

export default function WorkspaceTimeline() {
  const [i, setI] = useState(0);
  const [still, setStill] = useState(false);
  useEffect(() => { setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  useEffect(() => {
    if (still) return;
    const id = setInterval(() => setI((x) => (x + 1) % (MILES.length + 1)), 2200);
    return () => clearInterval(id);
  }, [still]);
  const reached = still ? MILES.length : i; // milestones 0..reached-1 are lit

  return (
    <ol className="wt">
      <span className="wt-rail"><span className="wt-fill" style={{ height: `${(Math.max(reached - 1, 0) / (MILES.length - 1)) * 100}%` }} /></span>
      {MILES.map((m, k) => {
        const lit = k < reached;
        return (
          <li key={m.t} className={`wt-item${lit ? " on" : ""}${m.planned ? " planned" : ""}${k === reached - 1 ? " now" : ""}`}>
            <span className="wt-dot" />
            <div>
              <h3>{m.t}{m.planned && <span className="status" style={{ marginLeft: 10 }}>Planned</span>}</h3>
              <p>{m.d}</p>
              <div className="wt-docs">{m.docs.map((x) => <span key={x}>{x}</span>)}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
