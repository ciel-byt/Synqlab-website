import { BOOKING_URL } from "../content.js";

// Calendly inline embed. embed_domain tells Calendly which site is hosting it.
function embedUrl() {
  const domain = typeof window !== "undefined" ? window.location.hostname : "";
  return `${BOOKING_URL}?hide_gdpr_banner=1&embed_type=Inline&embed_domain=${encodeURIComponent(domain)}`;
}

export default function BookCall() {
  return (
    <section className="hero" style={{ paddingBottom: 40 }}>
      <div className="wrap hero-split book reveal">
        <div>
          <p className="eyebrow" style={{ marginBottom: 16 }}>Book a call</p>
          <h1>Tell us about your target.</h1>
          <p className="lead">
            A short call to understand your target, your data, and whether we can help. Pick a time that works for you.
          </p>
          <p className="book-alt">
            Calendar not loading? <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">Open it in a new tab</a>.
          </p>
        </div>
        <div className="book-embed">
          <iframe src={embedUrl()} title="Book a call with SynqLab" loading="lazy" />
        </div>
      </div>
    </section>
  );
}
