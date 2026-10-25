import { useEffect, useState } from "react";
import { MessageSquare, Sparkles, CircleCheck, RefreshCw } from "lucide-react";

// Plain-language animation of Aria's loop: ask, propose, check, learn. The active step lights up and cycles.

const STAGES = [
  { Icon: MessageSquare, t: "Ask", d: "Say what you need, and add your own examples if you have them." },
  { Icon: Sparkles, t: "Propose", d: "Aria suggests many candidate proteins, from a private model that you host and own." },
  { Icon: CircleCheck, t: "Check", d: "Each candidate is tested against your request, on the computer." },
  { Icon: RefreshCw, t: "Learn", d: "Aria learns which ones worked and which did not, then tries again. The next round starts better." },
];

export default function AriaLoop() {
  const [tick, setTick] = useState(0);
  const [still, setStill] = useState(false);
  useEffect(() => { setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  useEffect(() => {
    if (still) return;
    const id = setInterval(() => setTick((t) => t + 1), 1700);
    return () => clearInterval(id);
  }, [still]);

  const stage = still ? 2 : tick % 4;

  return (
    <div className="al">
      <ol className="al-steps">
        {STAGES.map(({ Icon, t, d }, i) => (
          <li key={t} className={stage === i ? "on" : ""}>
            <button onClick={() => setTick(i)} aria-label={t}>
              <span className="al-ico"><Icon size={20} strokeWidth={1.7} /></span>
              <b>{t}</b>
              <small>{d}</small>
            </button>
          </li>
        ))}
      </ol>

    </div>
  );
}
