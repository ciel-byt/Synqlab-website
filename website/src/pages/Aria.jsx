import { Link } from "react-router-dom";
import { SectionHead, ArrowLink } from "../components/ui.jsx";
import ProductPage from "../components/ProductPage.jsx";
import MetricChart from "../components/MetricChart.jsx";
import AriaLoop from "../components/AriaLoop.jsx";
import AriaExamples from "../components/AriaExamples.jsx";
import AriaRounds from "../components/AriaRounds.jsx";

export default function Aria() {
  return (
    <ProductPage
      eyebrow="Product · Aria"
      title="AI that designs proteins."
      lead="Aria is a self-improving framework for protein design. It turns your own data into a private model, designs new proteins that do the jobs you ask for, checks them, and gets better with every round."
      video={{ src: "/video/aria.mp4", poster: "/video/aria-poster.jpg", title: "Aria", length: "About a minute", note: "A request and examples go in, checked candidates come out, then the model learns and tries again. In-silico." }}
    >
      <section className="soft">
        <div className="wrap">
          <SectionHead
            eyebrow="What Aria did"
            title="The natural protein, and the one Aria designed."
            lead="Three recorded requests. For each, the natural protein on the left and a new sequence that Aria wrote for the same job."
          />
          <AriaExamples />
        </div>
      </section>

      <section>
        <div className="wrap">
          <SectionHead
            eyebrow="It improves itself"
            title="Better with every round."
            lead="Each round, Aria checks its own designs, finds where the model is weak and tunes it. Here is how often its designs were recognised as the right protein family."
          />
          <AriaRounds />
          <div style={{ marginTop: 56 }}>
            <SectionHead eyebrow="How it works" title="A model that learns from every round." />
            <AriaLoop />
          </div>
        </div>
      </section>

      <section className="soft">
        <div className="wrap">
          <SectionHead
            eyebrow="Why design proteins"
            title="Keep what works. Improve what matters."
            lead="Protein design does not always mean inventing a new function. Often it means keeping the original one and changing the protein around it."
          />
          <div className="why">
            <div className="card">
              <h3>Improve a useful property</h3>
              <p>Humalog is insulin with two neighbouring amino acids swapped. It still does the same job, but it clumps together less, so it acts faster. It became a widely used rapid-acting insulin.</p>
            </div>
            <div className="card">
              <h3>Make it instead of finding it</h3>
              <p>Many proteins used to be taken from animals, plants or microbes. Insulin was once extracted from animal pancreas. A designed protein can be made in the lab instead.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <SectionHead
            eyebrow="Use it"
            title="Built for biotech, pharma and research labs."
            lead="Bring your own protein data. Aria builds a model for your target that you host and own."
          />
          <div className="explore">
            <div className="card">
              <h3>On its own</h3>
              <p>Host the model yourself and keep the weights. Aria is a framework you can run without anything else from us.</p>
            </div>
            <div className="card">
              <h3>On SynqLab</h3>
              <p>Run Aria with agents, tools and compute in one workspace, with every step recorded toward a regulatory filing.</p>
            </div>
            <div className="card">
              <h3>With you</h3>
              <p>Book a call and we will set Aria up on your protein and your data.</p>
            </div>
          </div>
          <div className="cta-row">
            <Link className="btn" to="/book-a-call">Book a call</Link>
            <a className="btn ghost" href="/login">Sign in</a>
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
