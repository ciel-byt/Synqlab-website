import { useState } from "react";
import { Link } from "react-router-dom";

// Numbers are from the Aria paper (NeurIPS 2026), as supplied by the founder. Base = the unadapted general-purpose model.
// group "adherence": percent of prompts where the property was met. group "mcc": Matthews correlation (charge is the Pearson r between requested and realized charge), 0 to 1.
// base: null means no base value is reported (not zero).
const METRICS = [
  { id: "length", label: "Length ±10%", group: "adherence", base: 11.6, aria: 88.8 },
  { id: "hydro", label: "Hydrophobicity", group: "adherence", base: 62.4, aria: 86.9 },
  { id: "stab", label: "Stability", group: "adherence", base: 52.9, aria: 72.2 },
  { id: "agg", label: "Aggregation", group: "adherence", base: 42, aria: 75 },
  { id: "cys", label: "Cysteine count", group: "adherence", base: 23.3, aria: 68.9 },
  { id: "charge", label: "Charge (r)", group: "mcc", base: 0.26, aria: 0.89 },
  { id: "tm", label: "Transmembrane", group: "mcc", base: 0.28, aria: 0.87 },
  { id: "signal", label: "Signal peptide", group: "mcc", base: 0.07, aria: 0.74 },
];
const DEFAULT = ["length", "hydro", "stab", "agg", "cys", "charge", "tm", "signal"];
const GROUPS = [
  { id: "adherence", title: "Adherence (%)", scale: 100, fmt: (v) => v },
  { id: "mcc", title: "Correlation (MCC; charge r)", scale: 1, fmt: (v) => v.toFixed(2) },
];

function Col({ m, scale, fmt }) {
  const h = (v) => `${Math.max((v / scale) * 100, 1.5)}%`;
  return (
    <div className="mc-col">
      <div className="mc-bars">
        <div className="mc-bar-wrap">
          {m.base != null ? (
            <>
              <em>{fmt(m.base)}</em>
              <i className="base" style={{ height: h(m.base) }} />
            </>
          ) : (
            <em className="na">n/a</em>
          )}
        </div>
        <div className="mc-bar-wrap">
          <em>{fmt(m.aria)}</em>
          <i className="aria" style={{ height: h(m.aria) }} />
        </div>
      </div>
      <span className="mc-label">{m.label}</span>
    </div>
  );
}

export default function MetricChart({ compact }) {
  const [sel, setSel] = useState(DEFAULT);
  const toggle = (id) =>
    setSel((s) => (s.includes(id) ? (s.length > 1 ? s.filter((x) => x !== id) : s) : [...s, id]));

  return (
    <div className={`mc${compact ? " compact" : ""}`}>
      <div className="mc-chips" role="group" aria-label="Choose metrics to compare">
        {METRICS.map((m) => (
          <button key={m.id} className={`chip${sel.includes(m.id) ? " on" : ""}`} aria-pressed={sel.includes(m.id)} onClick={() => toggle(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="mc-plot">
        {GROUPS.map((g) => {
          const ms = METRICS.filter((m) => m.group === g.id && sel.includes(m.id));
          if (!ms.length) return null;
          return (
            <div className="mc-group" key={g.id} style={{ flex: ms.length }}>
              <div className="mc-cols">
                {ms.map((m) => <Col key={m.id} m={m} scale={g.scale} fmt={g.fmt} />)}
              </div>
              <p className="mc-title">{g.title}</p>
            </div>
          );
        })}
      </div>
      <div className="mc-foot">
        <span className="mc-legend"><i className="base" />General AI<i className="aria" />Aria</span>
        <small>In-silico. <Link to="/research/aria-controllability">Aria · NeurIPS 2026 →</Link></small>
      </div>
    </div>
  );
}
