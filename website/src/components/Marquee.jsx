import { programs, collaborators, COLLABORATORS_CONFIRMED, logos } from "../content.js";

// Programs are credits/membership, not investment. Universities are research collaborations.
// Per-logo heights so wordmarks and crests look balanced.
const heights = {
  "NVIDIA Inception": "18px",
  "Google for Startups": "24px",
  "Amazon Web Services": "28px",
  "University of Toronto": "40px",
  "McMaster University": "40px",
  "University of Manitoba": "40px",
};

export default function Marquee() {
  const names = [...programs, ...(COLLABORATORS_CONFIRMED ? collaborators : [])];
  return (
    <div className="marquee" aria-label="Research collaborations">
      <span className="marquee-label">Research<br />collaborations</span>
      <div className="marquee-view">
        <div className="marquee-track">
          {[0, 1].map((k) => (
            <ul className="marquee-set" key={k} aria-hidden={k === 1}>
              {names.map((n) => <li key={n}>{logos[n] ? <img src={logos[n]} alt={n} style={{ "--h": heights[n] }} /> : n}</li>)}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
}
