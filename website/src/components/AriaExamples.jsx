import { useState } from "react";
import examples from "../ariaExamples.json";
import AriaViewer from "./AriaViewer.jsx";

// Plain-language details for the natural protein behind each recorded design.
const natural = {
  PF00237: { name: "Large ribosomal subunit protein uL22", org: "Methanothrix thermoacetophila", job: "Part of the ribosome, the machine that builds proteins. It binds ribosomal RNA." },
  PF00467: { name: "Large ribosomal subunit protein uL24", org: "Geobacillus sp. WCH70", job: "Part of the ribosome. It helps hold the RNA in place." },
  PF03652: { name: "Pre-16S rRNA nuclease (YqgF)", org: "Pediococcus pentosaceus", job: "An enzyme that trims ribosomal RNA so the ribosome can be assembled." },
};
const SKIP = new Set(["Domain", "Organism"]);

export default function AriaExamples() {
  const [i, setI] = useState(0);
  const e = examples[i], n = natural[e.family];
  return (
    <div>
      <div className="tchips ex-tabs" role="tablist">
        {examples.map((x, k) => (
          <button key={x.name} role="tab" aria-selected={k === i} className={k === i ? "tchip on" : "tchip"} onClick={() => setI(k)}>{x.name}</button>
        ))}
      </div>

      <div className="ex">
        <AriaViewer family={e.family.toLowerCase()} />

        <div className="ex-top">
          <div>
            <span className="eyebrow">Natural protein</span>
            <h3>{n.name}</h3>
            <p>{n.org} · UniProt {e.acc} · {e.natLen} amino acids</p>
            <p className="ex-job">{n.job}</p>
          </div>
          <div className="ex-arrow" aria-hidden="true">→</div>
          <div>
            <span className="eyebrow">Designed by Aria</span>
            <h3>{e.name}</h3>
            <p>A new sequence · {e.desLen} amino acids</p>
            <p className="ex-job">Same job. A protein that did not exist before.</p>
          </div>
        </div>

        <div className="ex-ask">
          <span className="eyebrow">Aria was asked for</span>
          <div className="ex-chips">
            {Object.entries(e.spec).filter(([k]) => !SKIP.has(k)).map(([k, v]) => <span key={k}>{k}: <b>{v}</b></span>)}
          </div>
        </div>

        <div className="ex-stats">
          <div><b>{Math.round(e.identity)}%</b><span>identical to the natural protein</span></div>
          <div><b>{e.plddt.toFixed(0)}<small>/100</small></b><span>structure confidence</span></div>
          <div><b>{e.tm.toFixed(2)}</b><span>shape match to the natural protein (TM-score, 1 = same shape)</span></div>
          <div><b>{e.hit ? "Yes" : "No"}</b><span>recognized as the same protein family</span></div>
        </div>
        <p className="ex-note">Recorded Aria output. Designed and checked on the computer. Natural structures are predicted, like Aria's.</p>
      </div>
    </div>
  );
}
