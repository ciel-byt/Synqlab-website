import { Link } from "react-router-dom";
import { SectionHead, ArrowLink } from "../components/ui.jsx";
import ProductPage from "../components/ProductPage.jsx";
import MetricChart from "../components/MetricChart.jsx";
import AriaLoop from "../components/AriaLoop.jsx";

export default function Aria() {
  return (
    <ProductPage
      eyebrow="Product · Aria"
      title="AI that designs proteins."
      lead="Aria is a customizable AI for proteins. Tell it what you need and give it your own examples. It proposes proteins, checks them, and gets better with every round."
      video={{ title: "Aria", length: "60–90 seconds", note: "A request and examples go in, checked candidates come out, then the model learns and tries again. In-silico." }}
    >
      <section className="soft">
        <div className="wrap">
          <SectionHead eyebrow="How it works" title="A model that learns from every round." />
          <AriaLoop />
        </div>
      </section>

      <section>
        <div className="wrap">
          <SectionHead
            eyebrow="Try it"
            title="Want to try Aria?"
            lead="Watch the demo video above. To use it yourself, sign in, or book a call and we will set you up."
          />
          <div className="cta-row">
            <a className="btn" href="/login">Sign in</a>
            <Link className="btn ghost" to="/book-a-call">Book a call</Link>
          </div>
        </div>
      </section>

      <section className="soft">
        <div className="wrap">
          <SectionHead
            eyebrow="Results"
            title="Control, measured."
            lead="Pick a property to compare. Aria against a general-purpose AI, across the things a request can ask for."
          />
          <MetricChart />
          <div style={{ marginTop: 28 }}>
            <ArrowLink to="/research/aria-controllability">Read the paper</ArrowLink>
          </div>
        </div>
      </section>
    </ProductPage>
  );
}
