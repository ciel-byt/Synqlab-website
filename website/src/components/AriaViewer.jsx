import { useEffect, useRef, useState } from "react";
import { asset } from "../asset.js";

// Natural = warm grey, Aria = pine. Rotation only: no mouse, no touch, no controls. The 3D library loads on demand.
const NAT = "#9b9a92", ARIA = "#1f7a5c";
const PANELS = [
  { id: "natural", title: "Natural protein", show: ["n"] },
  { id: "overlay", title: "Laid on top of each other", show: ["n", "a"] },
  { id: "aria", title: "Designed by Aria", show: ["a"] },
];

export default function AriaViewer({ family }) {
  const els = useRef({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false, raf = 0, viewers = [];
    setReady(false);
    (async () => {
      const [$3Dmol, nat, aria] = await Promise.all([
        import("3dmol"),
        fetch(asset(`/structures/${family}-natural.pdb`)).then((r) => r.text()),
        fetch(asset(`/structures/${family}-aria.pdb`)).then((r) => r.text()),
      ]);
      if (dead) return;
      viewers = PANELS.map((p) => {
        const v = $3Dmol.createViewer(els.current[p.id], { backgroundAlpha: 0 });
        v.addModel(nat, "pdb"); v.addModel(aria, "pdb");
        v.setStyle({ model: 0 }, p.show.includes("n") ? { cartoon: { color: NAT, opacity: p.id === "overlay" ? 0.9 : 1 } } : {});
        v.setStyle({ model: 1 }, p.show.includes("a") ? { cartoon: { color: ARIA } } : {});
        v.zoomTo(); v.zoom(1.2); v.render();
        v.getCanvas().style.pointerEvents = "none";
        return v;
      });
      setReady(true);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const tick = () => { viewers.forEach((v) => { v.rotate(0.45, "y"); v.render(); }); raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
      }
    })().catch(() => {});
    return () => { dead = true; cancelAnimationFrame(raf); viewers.forEach((v) => { try { v.clear(); v.getCanvas().remove(); } catch {} }); };
  }, [family]);

  return (
    <div className="v3">
      {PANELS.map((p, i) => (
        <figure key={p.id} className={p.id}>
          <div className={ready ? "v3-canvas" : "v3-canvas loading"} ref={(el) => (els.current[p.id] = el)} role="img" aria-label={p.title} />
          <figcaption><i style={{ background: p.id === "aria" ? ARIA : p.id === "natural" ? NAT : `linear-gradient(90deg, ${NAT} 50%, ${ARIA} 50%)` }} />{p.title}</figcaption>
        </figure>
      ))}
    </div>
  );
}
