import { Link } from "react-router-dom";
import { ArrowLink } from "../components/ui.jsx";
import AppStack from "../components/AppStack.jsx";
import LoopDiagram from "../components/LoopDiagram.jsx";
import StructureCompare from "../components/StructureCompare.jsx";
import Marquee from "../components/Marquee.jsx";
import { steps } from "../content.js";

const explore = [
  { to: "/aria", t: "Aria", d: "Our self-improving agent for protein design, with real designed proteins." },
  { to: "/platform", t: "SynqLab", d: "The agent platform: agents, tools and compute in one place, with every step recorded." },
  { to: "/research", t: "Research", d: "Papers and notes behind SynqLab, with the evidence and its limits." },
  { to: "/company", t: "Company", d: "Who we are, and who supports and works with us." },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap hero-split reveal">
          <div className="hero-copy">
            <h1>Self-improving AI agents for biology.</h1>
            <p className="lead">
              Aria, our first agent, designs proteins that don't exist in nature from your own data. Use it on its own, or on SynqLab, our agent platform.
            </p>
          </div>
          <AppStack />
        </div>
      </section>

      <Marquee />

      <section className="soft">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow" style={{ marginBottom: 14 }}>Mission</p>
            <h2>Every lab should own a model that gets better at its problem.</h2>
          </div>
          <div className="mission">
            <ol className="flow">
              {steps.map((s) => (
                <li key={s.n}>
                  <span className="dot">{s.n}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mission-viz">
              <LoopDiagram />
            </div>
          </div>
          <div className="proof">
            <div className="proof-head">
              <p className="eyebrow">Aria · our first domain, proteins</p>
              <h3>Aria, our protein AI, on a real request.</h3>
            </div>
            <StructureCompare />
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="explore">
            {explore.map((x) => (
              <Link to={x.to} className="card" key={x.to}>
                <h3>{x.t}</h3>
                <p>{x.d}</p>
                <span style={{ marginTop: 8, fontWeight: 500, color: "var(--pine)" }}>Open →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
