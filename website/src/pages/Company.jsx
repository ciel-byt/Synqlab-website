import { SectionHead, Backers } from "../components/ui.jsx";
import { team, advisors } from "../content.js";
import { asset } from "../asset.js";

// Initials stand in until there is a photo on file.
function Avatar({ person }) {
  if (person.photo) {
    return (
      <div className="avatar">
        <img
          src={person.photo}
          alt={person.name}
          style={{ transformOrigin: person.pos, "--zoom": person.zoom, "--tx": person.tx, "--ty": person.ty }}
        />
      </div>
    );
  }
  const initials = person.name.split(" ").map((w) => w[0]).join("");
  return <div className="avatar mono-av" aria-hidden="true"><span>{initials}</span></div>;
}

function Links({ person }) {
  if (!person.linkedin && !person.scholar) return null;
  return (
    <div className="plinks">
      {person.linkedin && (
        <a href={person.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${person.name} on LinkedIn`} title="LinkedIn">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#0A66C2" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" /></svg>
        </a>
      )}
      {person.scholar && (
        <a href={person.scholar} target="_blank" rel="noopener noreferrer" aria-label={`${person.name} on Google Scholar`} title="Google Scholar">
          <img src={asset("/logos/googlescholar.svg")} alt="" width="22" height="22" />
        </a>
      )}
    </div>
  );
}

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
                <Avatar person={m} />
                <h3>{m.name}</h3>
                <p className="mono role" style={{ fontSize: "0.82rem", color: "var(--pine)" }}>{m.role}</p>
                <p>{m.bio}</p>
                <Links person={m} />
              </div>
            ))}
          </div>

          {advisors.length > 0 && (
            <div className="advisors">
              <p className="eyebrow">{advisors.length > 1 ? "Academic advisors" : "Academic advisor"}</p>
              {advisors.map((a) => (
                <div className="card advisor" key={a.name}>
                  <Avatar person={a} />
                  <div className="advisor-in">
                    <h3>{a.name}</h3>
                    <p className="affil">{a.affil}</p>
                    {a.bio && <p>{a.bio}</p>}
                  </div>
                  <Links person={a} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="soft tight" id="supporters">
        <div className="wrap"><Backers /></div>
      </section>

    </>
  );
}
