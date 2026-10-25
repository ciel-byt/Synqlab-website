import { useEffect, useRef, useState } from "react";

import { token, confidenceColor } from "../theme.js";
import { asset } from "../asset.js";

// 3Dmol.js from cdnjs, loaded on demand. Structures are ESMFold predictions (B-factor column = pLDDT, 0-1).
const SRC = "https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.4.2/3Dmol-min.js";
let loading;
function load3Dmol() {
  if (window.$3Dmol) return Promise.resolve(window.$3Dmol);
  loading ||= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.onload = () => res(window.$3Dmol);
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return loading;
}

function Viewer({ url, label, complex }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let v;
    let dead = false;
    (async () => {
      try {
        const [$3Dmol, text] = await Promise.all([load3Dmol(), fetch(url).then((r) => r.text())]);
        if (dead || !ref.current) return;
        v = $3Dmol.createViewer(ref.current, { backgroundColor: token("--bg-soft") });
        v.addModel(text, "pdb");
        if (complex) {
          // Target in light gray, binder in green with side chains.
          v.setStyle({ chain: "A" }, { cartoon: { color: token("--target-chain"), opacity: 0.9 } });
          v.setStyle({ chain: "B" }, { cartoon: { color: token("--brand") }, stick: { color: token("--brand"), radius: 0.18 } });
        } else {
          v.setStyle({}, { cartoon: { colorfunc: (a) => confidenceColor(a.b) } });
        }
        v.zoomTo();
        v.zoom(complex ? 0.85 : 1.25);
        v.spin("y", 0.6);
        v.render();
      } catch {
        setFailed(true);
      }
    })();
    return () => { dead = true; if (v) v.clear(); };
  }, [url, complex]);
  return (
    <div className="viewer" role="img" aria-label={label}>
      {failed ? <p className="mute">Structure viewer could not load.</p> : <div ref={ref} className="viewer-canvas" />}
    </div>
  );
}

const PANELS = [
  { url: asset("/structures/before.pdb"), t: "General AI", d: "55 amino acids · charge +5 · confidence 39 of 100", c: "bad", r: "Misses the spec" },
  { url: asset("/structures/after.pdb"), t: "Aria", d: "127 amino acids · on-target charge · confidence 79 of 100", c: "ok", r: "Meets the spec" },
];

export default function StructureCompare({ hidePrompt }) {
  return (
    <div className="demo">
      {!hidePrompt && (
        <p className="spec">
          <b>Request:</b> a protein from family PF00416. Length 123, charge +17, high confidence, does not cross the membrane.
        </p>
      )}
      <div className="demo-row">
        {PANELS.map((x) => (
          <figure key={x.t} className="demo-struct">
            <Viewer url={x.url} complex={x.complex} label={`Predicted structure: ${x.t}`} />
            <figcaption>
              <span><b>{x.t}</b> <em className={x.c}>{x.r}</em></span>
              <small>{x.d}</small>
            </figcaption>
          </figure>
        ))}
      </div>
      <small className="demo-note">
        <span className="legend"><i style={{ background: "var(--conf-very-high)" }} />very high<i style={{ background: "var(--conf-high)" }} />high<i style={{ background: "var(--conf-low)" }} />low<i style={{ background: "var(--conf-very-low)" }} />very low confidence</span>
       
      </small>
    </div>
  );
}
