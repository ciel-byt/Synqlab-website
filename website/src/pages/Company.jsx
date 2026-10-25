import { SectionHead, Backers } from "../components/ui.jsx";
import { team } from "../content.js";
import { asset } from "../asset.js";

export default function Company() {
  return (
    <>
      <section className="hero" id="about" style={{ paddingBottom: 40 }}>
        <div className="wrap reveal">
          <p className="eyebrow" style={{ marginBottom: 16 }}>About us</p>
          <h1 style={{ maxWidth: "16ch" }}>Biology and AI, built by two brothers.</h1>
          <p className="lead" style={{ margin: "28px 0 0" }}>
            We build AI that learns from the lab. One of us comes from the bench, the other from production AI systems.
          </p>
        </div>
      </section>

      <section id="team" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <SectionHead title="Our team" />
          <div className="grid-2">
            {team.map((m) => (
              <div className="card person" key={m.name}>
                <div className="avatar"><img src={m.photo} alt={m.name} style={{ transformOrigin: m.pos, "--zoom": m.zoom, "--tx": m.tx, "--ty": m.ty }} /></div>
                <h3>{m.name}</h3>
                <p className="mono role" style={{ fontSize: "0.82rem", color: "var(--pine)" }}>{m.role}</p>
                <p>{m.bio}</p>
                {(m.linkedin || m.scholar) && (
                  <div className="plinks">
                    {m.linkedin && (
                      <a href={m.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} on LinkedIn`} title="LinkedIn">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#0A66C2" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" /></svg>
                      </a>
                    )}
                    {m.scholar && (
                      <a href={m.scholar} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} on Google Scholar`} title="Google Scholar">
                        <img src={asset("/logos/googlescholar.svg")} alt="" width="22" height="22" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="soft tight" id="supporters">
        <div className="wrap"><Backers /></div>
      </section>

    </>
  );
}
