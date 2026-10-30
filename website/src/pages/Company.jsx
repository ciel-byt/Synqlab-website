import { SectionHead, Backers } from "../components/ui.jsx";
import { team, advisors } from "../content.js";

// A portrait, or the person's initials until there is a photo on file.
function Portrait({ person }) {
  if (!person.photo) {
    const initials = person.name.split(" ").map((w) => w[0]).join("");
    return <div className="rost-ph rost-mono" aria-hidden="true"><span>{initials}</span></div>;
  }
  return (
    <div className="rost-ph">
      <img src={person.photo} alt={person.name} style={{ objectPosition: person.pos }} loading="lazy" />
    </div>
  );
}

function Links({ person }) {
  if (!person.linkedin && !person.scholar) return null;
  return (
    <p className="rost-links">
      {person.linkedin && (
        <a href={person.linkedin} target="_blank" rel="noopener noreferrer">
          LinkedIn
        </a>
      )}
      {person.scholar && (
        <a href={person.scholar} target="_blank" rel="noopener noreferrer">
          Google Scholar
        </a>
      )}
    </p>
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

          <p className="eyebrow roster-label">Founders</p>
          <div className="roster">
            {team.map((m) => (
              <article className="rost" key={m.name}>
                <Portrait person={m} />
                <div className="rost-in">
                  <h3>{m.name}</h3>
                  <p className="role">{m.role}</p>
                  {m.bio && <p className="rost-bio">{m.bio}</p>}
                  <Links person={m} />
                </div>
              </article>
            ))}
          </div>

          {advisors.length > 0 && (
            <>
              <p className="eyebrow roster-label">
                {advisors.length > 1 ? "Academic advisors" : "Academic advisor"}
              </p>
              <div className="roster adv">
                {advisors.map((a) => (
                  <article className="rost mini" key={a.name}>
                    <Portrait person={a} />
                    <div className="rost-in">
                      <h3>{a.name}</h3>
                      {a.affil && <p className="affil">{a.affil}</p>}
                      <Links person={a} />
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="soft tight" id="supporters">
        <div className="wrap"><Backers /></div>
      </section>

    </>
  );
}
