// Detail text for each node of the SynqLab diagram. Draft: review against what the platform does today.
// status is shown quietly in the side panel only. `to` links to a product page.

export const NODES = {
  goal: {
    name: "Your goal and data",
    what: "Every project starts with a goal in plain language and the data you already have.",
    bullets: ["Text goals, sequences, structures and assay data", "Public data, your own, or both", "Private to your organization"],
  },
  agent: {
    name: "SynqLab agent",
    what: "The planner at the center. It turns a goal into work and decides what runs next.",
    bullets: ["Plans the work and writes code", "Trains and tunes models, and submits jobs", "Calls specialist agents and tools", "Decides the next step and learns from the results"],
  },
  aria: {
    name: "Aria",
    what: "Our protein design agent.",
    bullets: [
      "Generates sequences that meet property targets: length, hydrophobicity, stability, cysteine count, transmembrane and signal peptide",
      "Customizes a model on public or private data with supervised and preference tuning",
      "You host the model and you own it",
    ],
    status: "Available",
    to: "/aria",
  },
  lyra: {
    name: "Lyra",
    what: "The small-molecule design agent, built on the same platform.",
    bullets: ["Brings the same customization loop to small molecules", "Uses the same tools, records and controls"],
    status: "In development",
    to: "/lyra",
  },
  literature: {
    name: "Literature",
    what: "Searches and synthesizes papers, so designs start from what is already known.",
    bullets: ["Finds relevant work for a target", "Summaries with sources"],
    status: "Planned",
  },
  reports: {
    name: "Reports",
    what: "Deep research: long, sourced reports on a target or a question.",
    bullets: ["Background on a target", "A written record the team can share"],
    status: "Planned",
  },
  data: {
    name: "Data analysis",
    what: "Explores and summarizes your datasets and assay results.",
    bullets: ["Tables and plots", "Checks data before it is used for tuning"],
    status: "Planned",
  },
  lab: {
    name: "Lab agent",
    what: "Connects design to in-vitro work: samples, assays, and the results coming back.",
    bullets: ["Prepares what to test", "Brings measurements back into the project"],
    status: "Roadmap",
  },
  structure: {
    name: "Structure prediction",
    what: "Predicts the 3D structure of a design, alone or bound to a target.",
    bullets: ["Single chains and complexes", "Confidence scores (pLDDT, ipTM) travel with every candidate", "The agent picks the engine for the task"],
    engines: ["AlphaFold", "Boltz", "Chai-1", "ESMFold"],
    note: "Hosted, not built by us.",
  },
  design: {
    name: "Generative design",
    what: "Generative tools for backbones, sequences and binders, used alongside our own agents.",
    bullets: ["Backbone generation and sequence design", "Binder design against a target", "Candidates go to the same scoring as everything else"],
    engines: ["RFdiffusion", "ProteinMPNN", "BoltzGen", "BindCraft"],
    note: "Hosted, not built by us.",
  },
  docking: {
    name: "Docking",
    what: "Predicts how a molecule or protein binds to a target.",
    bullets: ["Protein and ligand docking", "Poses and scores returned to the project", "Feeds the small-molecule work"],
    engines: ["DiffDock", "AutoDock Vina", "GNINA"],
    note: "Hosted, not built by us.",
  },
  dynamics: {
    name: "Molecular dynamics",
    what: "Simulates how a candidate moves and holds together over time.",
    bullets: ["Stability and flexibility checks", "Runs as a job on cloud GPUs"],
    engines: ["GROMACS"],
    note: "Hosted, not built by us.",
  },
  scoring: {
    name: "Scoring",
    what: "Ranks candidates by how well they meet the goal.",
    bullets: ["Model confidence: pLDDT and ipTM", "Physics-based energy and interface scoring", "Property checks against the requested targets"],
    engines: ["Rosetta"],
  },
  seqdb: {
    name: "Sequence analysis",
    what: "Checks sequences for family, topology and novelty, and looks up what is already known.",
    bullets: ["Clustering and similarity search", "Domain and family annotation", "Transmembrane and signal-peptide prediction", "Reference sequences and annotations"],
    engines: ["MMseqs2", "InterPro", "DeepTMHMM", "SignalP", "UniProt"],
  },
  code: {
    name: "Code",
    what: "Runs analysis code when a standard tool is not enough.",
    bullets: ["Python, bash or a container", "Every run is written to the audit trail"],
  },
  scheduler: {
    name: "Job scheduler",
    what: "Sends heavy jobs to an HPC cluster or the cloud and follows them to completion.",
    bullets: ["Queues, retries and status tracking", "Results return to the project automatically"],
  },
  gpu: {
    name: "GPU burst",
    what: "Adds cloud GPUs when a round needs more compute than you have on hand.",
    bullets: ["On demand, within your budget", "Released when the job finishes"],
  },
  budget: {
    name: "Budget and approval",
    what: "Sets spend limits and asks a person to approve costly steps.",
    bullets: ["Per-project limits", "Sign-off recorded in the audit trail"],
  },
  notify: {
    name: "Notify and handoff",
    what: "Alerts the team when something needs a decision, and hands work to a person.",
    bullets: ["A human stays in the loop", "Clear handoff with context attached"],
  },
  store: {
    name: "Knowledge store and audit trail",
    what: "The project's memory, and its record.",
    bullets: ["Notes and results, traceable and versioned", "Retrieval over everything the project has produced", "An append-only, signed audit log of every action"],
  },
  insilico: {
    name: "In-silico results",
    what: "Candidates with scores you can compare.",
    bullets: ["Confidence (pLDDT, ipTM) and novelty", "Each result is tagged by how it was measured"],
  },
  invitro: {
    name: "In-vitro results",
    what: "Wet-lab measurements that come back into the project.",
    bullets: ["Binding (SPR), purity (HPLC) and viability assays", "Joins the same record as the in-silico results"],
    status: "Roadmap",
  },
};
