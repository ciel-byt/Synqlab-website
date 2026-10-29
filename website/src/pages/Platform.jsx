import { SectionHead } from "../components/ui.jsx";
import { principles } from "../content.js";
import PlatformFlow from "../components/PlatformFlow.jsx";
import WorkspaceTimeline from "../components/WorkspaceTimeline.jsx";
import ProductPage from "../components/ProductPage.jsx";

const workspace = [
  { t: "Organizations and projects", d: "One workspace per organization, with projects, programs and roles for the whole team." },
  { t: "Documents and memory", d: "Briefs, datasets, reports and decisions stay versioned and searchable. Nothing lives in someone's inbox." },
  { t: "Approvals and handoffs", d: "Compute spend and key steps need a sign-off. People are notified and work is handed over cleanly." },
  { t: "A record you can hand over", d: "An append-only, signed audit log of what ran, on which data, with which model version." },
];

export default function Platform() {
  return (
    <ProductPage
      eyebrow="Product · SynqLab"
      title="Run biology agents in one place."
      lead="SynqLab is our agentic platform: agents, tools and compute in one workspace, with every step recorded. Use it with Aria, or on its own."
      video={{ title: "SynqLab", length: "90–120 seconds", note: "Open a project, give it a goal, watch agents and tools run, and see the record build." }}
    >
      <section>
        <div className="wrap">
          <SectionHead eyebrow="Architecture" title="Agents do the work. The platform runs everything around them." lead="Aria is an agent on SynqLab. New agents plug into the same platform, the same records and the same controls." />
          <PlatformFlow />
        </div>
      </section>

      <section className="soft">
        <div className="wrap split-2">
          <div>
            <SectionHead eyebrow="Team workspace" title="Built for teams, from the first idea to the filing." />
            <div className="wk-list">
              {workspace.map((x) => (
                <div key={x.t}>
                  <h3>{x.t}</h3>
                  <p>{x.d}</p>
                </div>
              ))}
            </div>
          </div>
          <WorkspaceTimeline />
        </div>
      </section>

      <section>
        <div className="wrap">
          <SectionHead eyebrow="Principles" title="Private, traceable, safe by design." />
          <div className="grid-3">
            {principles.map((p) => (
              <div className="card" key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </ProductPage>
  );
}
