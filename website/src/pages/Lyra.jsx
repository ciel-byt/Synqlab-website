import { SectionHead } from "../components/ui.jsx";
import ProductPage from "../components/ProductPage.jsx";

const how = [
  { n: "01", t: "Describe the molecule", d: "Ask for the properties you need in a small molecule." },
  { n: "02", t: "Customize on your data", d: "Plug in your own measurements. You host the model and you own it." },
  { n: "03", t: "Find the weak spots", d: "Each round, Lyra looks for where the model falls short and applies a targeted fix." },
];

export default function Lyra() {
  return (
    <ProductPage
      eyebrow="Product · Lyra · In development"
      title="Small molecules, on SynqLab."
      lead="Lyra is a SynqLab agent for small-molecule design. It will bring the same approach as Aria to a new domain."
      video={{ title: "Lyra", length: "Not recorded yet", note: "We will show it here when there is something real to show." }}
      howTitle="The same approach, a new domain."
      how={how}
    >
      <section>
        <div className="wrap">
          <SectionHead eyebrow="Results" title="Early days." lead="Lyra is in development. There are no results to show yet, and we will publish them here when there are." />
        </div>
      </section>
    </ProductPage>
  );
}
