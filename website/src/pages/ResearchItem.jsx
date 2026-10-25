import { useParams, Link } from "react-router-dom";
import { Tag } from "../components/ui.jsx";
import { posts } from "../content.js";
import { usePapers, SCHOLAR_URL } from "../papersApi.js";
import NotFound from "./NotFound.jsx";

export default function ResearchItem() {
  const { slug } = useParams();
  const { papers, loading } = usePapers();
  const item = [...papers, ...posts].find((p) => p.slug === slug);
  if (loading && !item) return <section className="hero"><div className="wrap"><p className="empty">Loading…</p></div></section>;
  if (!item) return <NotFound />;

  const link = item.doi ? { href: `https://doi.org/${item.doi}`, label: "Read the paper" } : item.url ? { href: item.url, label: "Read the paper" } : { href: SCHOLAR_URL, label: "Find it on Google Scholar" };
  const paras = item.body && item.body.length ? item.body : item.abstract ? [item.abstract] : [];

  return (
    <section className="hero">
      <div className="wrap reveal">
        <p style={{ marginBottom: 24 }}>
          <Link to="/research" className="arrow-link">← Research</Link>
        </p>
        <div className="meta" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16, color: "var(--mute)", fontSize: "0.9rem" }}>
          {item.kind && <Tag>{item.kind}</Tag>}
          {item.venue && <span>{item.venue}</span>}
          <span>{item.year}</span>
        </div>
        <h1 style={{ fontSize: "clamp(2rem, 4.5vw, 3.4rem)", maxWidth: "24ch" }}>{item.title}</h1>
        {item.authors && <p style={{ margin: "18px 0 0", color: "var(--mute)" }}>{item.authors}</p>}

        <div className="article" style={{ marginTop: 40 }}>
          {paras.length > 0 && !item.body?.length && <p className="mono" style={{ fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)" }}>Abstract</p>}
          {paras.map((para, i) => <p key={i}>{para}</p>)}
          {item.limits && <div className="callout"><b>Limits.</b> {item.limits}</div>}
          <p><a className="arrow-link" href={link.href} target="_blank" rel="noopener noreferrer">{link.label} →</a></p>
        </div>
      </div>
    </section>
  );
}
