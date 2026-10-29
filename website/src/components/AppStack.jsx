import { useEffect, useRef, useState } from "react";
import { asset } from "../asset.js";

// Three real screens, one at a time, walking through the loop: set up, run, ask.
// Each stage takes a screen recording (`video`) or, until one exists, a screenshot (`img`).
// Advances on its own, pauses on hover, click a number to jump.
// Rule: real screens only, and nothing on screen we would not show a customer.
const DWELL = 6500;

const stages = [
  {
    key: "setup",
    img: "/app/aria-setup.png",
    video: null, // "/app/aria-setup.mp4"
    title: "Set up a model",
    note: "Your data, a name, and how many rounds to run.",
    alt: "Choosing the data, naming the model and setting how many rounds of tuning to run.",
  },
  {
    key: "rounds",
    img: "/app/aria-rounds.png",
    video: null, // "/app/aria-rounds.mp4"
    title: "Run the rounds",
    note: "Each round generates, checks, and learns from the results.",
    alt: "A finished run: three rounds, each generating candidates, checking them and learning from the results.",
  },
  {
    key: "request",
    img: "/app/aria-request.png",
    video: null, // "/app/aria-request.mp4"
    title: "Ask for a protein",
    note: "Plain words in, a designed protein and its shape back.",
    alt: "A request written in plain words returns a designed protein with its predicted shape and a list of checks.",
  },
  {
    key: "models",
    img: "/app/aria-models.png",
    video: null, // "/app/aria-models.mp4"
    title: "Keep and deploy",
    note: "Every version kept, scored, and put to work.",
    alt: "A table of every model version with its scores, and where each one is deployed.",
  },
];

function Media({ s, eager }) {
  if (s.video) {
    return (
      <video
        src={asset(s.video)}
        poster={s.img ? asset(s.img) : undefined}
        autoPlay
        muted
        loop
        playsInline
        preload={eager ? "auto" : "metadata"}
        aria-label={s.alt}
      />
    );
  }
  return <img src={asset(s.img)} alt={s.alt} loading={eager ? "eager" : "lazy"} />;
}

export default function AppStack({ label = "synqlab.ai/lab/aria" }) {
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const still = useRef(false);

  useEffect(() => {
    still.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (held || still.current) return undefined;
    const t = setTimeout(() => setAt((i) => (i + 1) % stages.length), DWELL);
    return () => clearTimeout(t);
  }, [at, held]);


  return (
    <div
      className="stage"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
    >
      <div className="stage-view">
        {stages.map((s, i) => (
          <figure className="stage-shot" key={s.key} data-on={i === at ? "1" : "0"} aria-hidden={i === at ? undefined : true}>
            <span className="shot-bar">
              <span className="shot-dots" aria-hidden="true"><i /><i /><i /></span>
              <span className="shot-url">{label}</span>
            </span>
            <Media s={s} eager={i === 0} />
          </figure>
        ))}
      </div>

      <ol className="stage-steps">
        {stages.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              className={`stage-step${i === at ? " on" : ""}`}
              onClick={() => setAt(i)}
              aria-current={i === at ? "step" : undefined}
            >
              <span className="stage-num">{i + 1}</span>
              <span className="stage-text">
                <b>{s.title}</b>
                <small>{s.note}</small>
              </span>
              <span className="stage-rail">
                <i key={`${at}-${held}`} style={{ animationDuration: `${DWELL}ms` }} />
              </span>
            </button>
          </li>
        ))}
      </ol>

    </div>
  );
}
