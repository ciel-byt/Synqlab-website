// Recorded Aria tuning runs (Aria paper, NeurIPS 2026): share of designs recognised as the requested family, per tuning round.
// Round 0 is the supervised Aria base before tuning; values are the mean of two runs, a computational evaluation.
const FAMILIES = [
  { name: "uL22", rounds: [9.0, 31.1, 30.7, 38.7] },
  { name: "uL24", rounds: [28.4, 56.2, 69.6, 74.0] },
  { name: "YqgF", rounds: [44.2, 77.1, 80.8, 81.4] },
];
const LABELS = ["Start", "Round 1", "Round 2", "Round 3"];

export default function AriaRounds() {
  return (
    <div className="rd">
      <div className="rd-grid">
        {FAMILIES.map((f) => (
          <div className="card rd-card" key={f.name}>
            <h3>{f.name}</h3>
            <div className="rd-bars" role="img" aria-label={`${f.name}: ${f.rounds.join("%, ")}% of designs in the right family, by round`}>
              {f.rounds.map((v, i) => (
                <div className="rd-col" key={i}>
                  <em>{Math.round(v)}%</em>
                  <i className={`r${i}`} style={{ height: `${Math.max(v, 2)}%` }} />
                  <span>{LABELS[i]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="rd-note">
        Share of Aria's designs recognised as the requested protein family. Recorded results, mean of two runs. Checked on the computer.
      </p>
    </div>
  );
}
