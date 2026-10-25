import { Link } from "react-router-dom";
import { programs, collaborators, COLLABORATORS_CONFIRMED } from "../content.js";

export function Button({ to, variant = "", children }) {
  return (
    <Link to={to} className={`btn ${variant}`.trim()}>
      {children}
    </Link>
  );
}

export function ArrowLink({ to, children }) {
  return (
    <Link to={to} className="arrow-link">
      {children} →
    </Link>
  );
}

export function Tag({ children }) {
  return <span className="tag">{children}</span>;
}

export function SectionHead({ eyebrow, title, lead }) {
  return (
    <div className="sec-head">
      {eyebrow && <p className="eyebrow" style={{ marginBottom: 14 }}>{eyebrow}</p>}
      <h2>{title}</h2>
      {lead && <p className="lead" style={{ marginTop: 16 }}>{lead}</p>}
    </div>
  );
}

// Programs we are in (credits/membership, not investment) and, once confirmed, research collaborators.
export function Backers() {
  return (
    <div className="strip-row">
      {programs.length > 0 && (
        <div className="strip">
          <b>Supported by</b>
          {programs.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
      )}
      {COLLABORATORS_CONFIRMED && (
        <div className="strip">
          <b>Research collaborations</b>
          {collaborators.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      )}
    </div>
  );
}
