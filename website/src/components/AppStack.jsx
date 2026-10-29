import { useEffect, useState } from "react";
import { asset } from "../asset.js";

// Four real screens, one at a time: set up, run, ask, keep. Arrows and numbers to move
// between them, and it advances on its own until someone takes over.
// Each stage takes a screen recording (`video`) or, until one exists, a screenshot (`img`).
// Rule: real screens only, and nothing on screen we would not show a customer.
const DWELL = 7000;

const stages = [
  {
    key: "setup",
    img: "/app/aria-setup.png",
    video: null, // "/app/aria-setup.mp4"
    title: "Set up a model",
    alt: "Choosing the data, naming the model and setting how many rounds of tuning to run.",
  },
  {
    key: "rounds",
    img: "/app/aria-rounds.png",
    video: null, // "/app/aria-rounds.mp4"
    title: "Run the rounds",
    alt: "A finished run: three rounds, each generating candidates, checking them and learning from the results.",
  },
  {
    key: "request",
    img: "/app/aria-request.png",
    video: null, // "/app/aria-request.mp4"
    title: "Ask for a protein",
    alt: "A request written in plain words returns a designed protein with its predicted shape and a list of checks.",
  },
  {
    key: "models",
    img: "/app/aria-models.png",
    video: null, // "/app/aria-models.mp4"
    title: "Keep and deploy",
    alt: "A table of every model version with its scores, and where each one is deployed.",
  },
];

function Media({ s, eager }) {
  if (s.video) {
    return (
      <video
        src={asset(s.video)}
        poster={s.img ? asset(s.img) : undefined}
        autoPlay muted loop playsInline
        preload={eager ? "auto" : "metadata"}
        aria-label={s.alt}
      />
    );
  }
  return <img src={asset(s.img)} alt={s.alt} loading={eager ? "eager" : "lazy"} />;
}

export default function AppStack() {
  const [at, setAt] = useState(0);
  // Stops the carousel for good once someone clicks an arrow or a number.
  const [taken, setTaken] = useState(false);

  useEffect(() => {
    if (taken) return undefined;
    const t = setTimeout(() => setAt((i) => (i + 1) % stages.length), DWELL);
    return () => clearTimeout(t);
  }, [at, taken]);

  const go = (i) => {
    setTaken(true);
    setAt((i + stages.length) % stages.length);
  };

  return (
    <div className="stage">
      <div className="stage-view">
        {stages.map((s, i) => (
          <figure className="stage-shot" key={s.key} data-on={i === at ? "1" : "0"} aria-hidden={i === at ? undefined : true}>
            <Media s={s} eager={i === 0} />
          </figure>
        ))}

        <button type="button" className="stage-arrow prev" onClick={() => go(at - 1)} aria-label="Previous screen">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
        </button>
        <button type="button" className="stage-arrow next" onClick={() => go(at + 1)} aria-label="Next screen">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div className="stage-foot">
        <div className="stage-dots">
          {stages.map((s, i) => (
            <button
              type="button"
              key={s.key}
              className={`stage-dot${i === at ? " on" : ""}`}
              onClick={() => go(i)}
              aria-label={s.title}
              aria-current={i === at ? "true" : undefined}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <p className="stage-title">{stages[at].title}</p>
      </div>
    </div>
  );
}
