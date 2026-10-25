import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { posts, NEWS_HANDLE } from "../content.js";
import { usePapers } from "../papersApi.js";

// Latest posts from the news account, fetched by the product server (the X token never reaches the browser).
function NewsFeed() {
  const [state, setState] = useState({ s: "loading", posts: [], handle: NEWS_HANDLE });
  useEffect(() => {
    let live = true;
    fetch("/api/public/news")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => live && setState({ s: "ok", posts: d.posts || [], handle: d.handle || NEWS_HANDLE }))
      .catch(() => live && setState({ s: "error", posts: [], handle: NEWS_HANDLE }));
    return () => { live = false; };
  }, []);
  if (state.s === "loading") return <div className="empty">Loading…</div>;
  if (state.s === "error" || !state.posts.length) return <div className="empty">News is not available right now.</div>;
  const fmt = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <div className="news">
      <p className="news-head">From <a href={`https://x.com/${state.handle}`} target="_blank" rel="noopener noreferrer">@{state.handle}</a></p>
      {state.posts.map((p) => (
        <a key={p.id} className="news-item" href={p.url} target="_blank" rel="noopener noreferrer">
          <time dateTime={p.created_at}>{fmt(p.created_at)}</time>
          <p>{p.text}</p>
          {p.image && <img src={p.image} alt="" loading="lazy" />}
          <span>View on X ↗</span>
        </a>
      ))}
    </div>
  );
}

const TABS = [
  { id: "papers", label: "Papers" },
  { id: "blog", label: "Blog" },
  { id: "news", label: "News" },
];

// Group items by year, newest first. Blog posts need a `year` field too.
function byYear(items) {
  const map = new Map();
  [...items].sort((a, b) => b.year - a.year).forEach((it) => {
    if (!map.has(it.year)) map.set(it.year, []);
    map.get(it.year).push(it);
  });
  return [...map.entries()];
}

export default function Research() {
  const [params, setParams] = useSearchParams();
  const q = params.get("tab");
  const tab = q === "blog" || q === "news" ? q : "papers";
  const { papers, loading } = usePapers();
  const [topic, setTopic] = useState("All");
  const topics = ["All", ...Array.from(new Set(papers.map((p) => p.topic)))];
  const shown = topic === "All" ? papers : papers.filter((p) => p.topic === topic);
  const items = tab === "news" ? [] : tab === "blog" ? posts : shown;
  const groups = byYear(items);

  return (
    <>
      <section className="rhead">
        <div className="wrap rhead-in reveal">
          <h1>Our Research</h1>
          <p className="lead"></p>
        </div>
        <div className="wrap">
          <div className="rtabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`rtab${tab === t.id ? " on" : ""}`}
                onClick={() => setParams(t.id === "papers" ? {} : { tab: t.id })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rbody">
        <div className="wrap">
          {tab === "news" ? (
            <NewsFeed />
          ) : loading && tab === "papers" ? (
            <div className="empty">Loading…</div>
          ) : groups.length === 0 ? (
            <div className="empty">First posts are coming soon.</div>
          ) : (
            <div className="ylist">
              {tab === "papers" && topics.length > 2 && (
                <div className="tchips" role="group" aria-label="Filter by topic">
                  {topics.map((t) => (
                    <button key={t} className={`tchip${topic === t ? " on" : ""}`} onClick={() => setTopic(t)}>{t}</button>
                  ))}
                </div>
              )}
              {groups.map(([year, list]) => (
                <div className="yrow" key={year}>
                  <div className="year">{year}</div>
                  <div className="yitems">
                    {list.map((p) => (
                      <Link to={`/research/${p.slug}`} className="yitem" key={p.slug}>
                        <div>
                          <h3>{p.title}</h3>
                          <p>{[p.authors, p.venue].filter(Boolean).join(" · ")}</p>
                          {p.kind && <span className="ykind">{p.kind}</span>}
                        </div>
                        <span aria-hidden="true">→</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
