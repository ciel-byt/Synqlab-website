const nodes = [
  { n: "01", t: "Your data", d: "Public, private, or both" },
  { n: "02", t: "Private model", d: "Tailored to your target" },
  { n: "03", t: "Make candidates", d: "Many ideas that fit your goal" },
  { n: "04", t: "Check them", d: "Each one is scored" },
  { n: "05", t: "Find the misses", d: "Where the model falls short" },
  { n: "06", t: "Fix", d: "A targeted update, tracked" },
];

export default function LoopDiagram() {
  return (
    <div className="panel" role="img" aria-label="One round: data, private model, generate, score, find weak spots, fix, repeat">
      <div className="loop">
        {nodes.map((x, i) => (
          <div key={x.n} className="loop-node" style={{ animationDelay: `${i * 1.5}s` }}>
            <b>{x.n}</b>
            <span>{x.t}</span>
            <small>{x.d}</small>
          </div>
        ))}
        <div className="loop-return">↺ every round starts from the improved model</div>
      </div>
    </div>
  );
}
