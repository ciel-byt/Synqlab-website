import { SectionHead } from "./ui.jsx";
import VideoSlot from "./VideoSlot.jsx";

// Shared template for every product page: hero with video, "how it works" cards, then product-specific sections.
// Sections passed as children should start with a white <section> and alternate with className="soft".
export default function ProductPage({ eyebrow, title, lead, video, howTitle, how, howCols = 3, howNote, children }) {
  return (
    <>
      <section className="hero" style={{ paddingBottom: 40 }}>
        <div className="wrap hero-split reveal">
          <div>
            <p className="eyebrow" style={{ marginBottom: 16 }}>{eyebrow}</p>
            <h1>{title}</h1>
            <p className="lead">{lead}</p>
          </div>
          <VideoSlot {...video} />
        </div>
      </section>

      {how && (
        <section className="soft">
          <div className="wrap">
            <SectionHead eyebrow="How it works" title={howTitle} />
            <div className={`grid-${howCols}`}>
              {how.map((x) => (
                <div className="card" key={x.n}>
                  <span className="num">{x.n}</span>
                  <h3>{x.t}</h3>
                  <p>{x.d}</p>
                </div>
              ))}
            </div>
            {howNote && <p className="how-note">{howNote}</p>}
          </div>
        </section>
      )}

      {children}
    </>
  );
}
