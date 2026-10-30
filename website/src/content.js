import { asset } from "./asset.js";

// All site copy and data lives here so it is easy to edit and, later, to move to a CMS or the backend.
// Rule: every number links to a paper; no testimonials, logos, or customers until we have written permission.

// Booking uses the existing Calendly page until we have our own form + backend.
export const BOOKING_URL = "https://calendly.com/sepehrbayat29/synqlab-demo";

// Programs we are actually in. These are memberships and credits, NOT investment: never label them "investors".
// Use each program's official badge/wording rules before showing logos. Text only for now.
// Hidden for now (founder will check each program's logo rules). To show again, restore:
// "NVIDIA Inception", "Google for Startups", "Amazon Web Services".
export const programs = [];

// University names need written permission (brand policies are strict). Flip to true once each lab confirms.
// Wording stays "research collaborations", not "partners", until the scope of each is in writing.
export const COLLABORATORS_CONFIRMED = true; // founder asked to show these; keep written confirmation on file
export const collaborators = [
  "University of Toronto",
  "McMaster University",
  "University of Manitoba",
];

// PLACEHOLDER logos from Wikipedia/Wikimedia (see public/logos/README.md). Validate, or replace with official files, before launch.
// Logos: drop official files (SVG/PNG) in public/logos/ and set the path here. Text shows until then.
// Use each organization's approved logo and follow its brand rules (NVIDIA Inception, Google for Startups, AWS, universities).
export const logos = {
  "NVIDIA Inception": asset("/logos/nvidia.svg"),
  "Google for Startups": asset("/logos/google.svg"),
  "Amazon Web Services": asset("/logos/aws.svg"),
  "University of Toronto": asset("/logos/uoft.svg"),
  "McMaster University": asset("/logos/mcmaster.svg"),
  "University of Manitoba": asset("/logos/manitoba.svg"),
};

export const nav = [
  { to: "/", label: "Home" },
  {
    to: "/platform",
    label: "Products",
    children: [
      { to: "/aria", icon: "aria", label: "Aria", note: "Self-improving protein design" },
      { to: "/platform", icon: "synqlab", label: "SynqLab", note: "The agentic platform" },
    ],
  },
  {
    to: "/research",
    label: "Research",
    children: [
      { to: "/research", icon: "papers", label: "Papers", note: "Peer-reviewed and preprints" },
      { to: "/research?tab=blog", icon: "blog", label: "Blog", note: "Notes from the work" },
      { to: "/research?tab=news", icon: "news", label: "News", note: "Daily biology news" },
    ],
  },
  {
    to: "/company",
    label: "Company",
    children: [
      { to: "/company", icon: "about", label: "About us", note: "Who we are and why" },
      { to: "/company#team", icon: "team", label: "Our team", note: "Founders and advisor" },
    ],
  },
];

export const steps = [
  {
    n: "01",
    title: "Bring your data",
    body: "Start from public data, your own measurements, or both.",
  },
  {
    n: "02",
    title: "Get a private model",
    body: "We tailor a model to your target. You host it, and you own it.",
  },
  {
    n: "03",
    title: "It learns from its misses",
    body: "Each round, it finds where it falls short and fixes it. Today our scientists guide this step. We are automating it.",
  },
];

export const coverage = [
  { name: "Proteins", status: "Available", note: "Property-controlled generation with Aria." },
  { name: "Peptides", status: "In development", note: "Binder design with small labeled datasets." },
  { name: "Small molecules", status: "Planned", note: "A new agent on the same platform." },
  { name: "Antibodies and enzymes", status: "Planned", note: "Reuses the same framework." },
];

// Numbers come only from papers we have confirmed as published. Do not add unpublished results here.
export const evidence = [
  {
    value: "11.6% → 88.8%",
    label: "Sequences within ±10% of the requested length",
    kind: "In-silico",
    source: "Aria · NeurIPS 2026",
    to: "/research/aria-controllability",
  },
  {
    value: "0.28 → 0.87",
    label: "Transmembrane-helix control (MCC)",
    kind: "In-silico",
    source: "Aria · NeurIPS 2026",
    to: "/research/aria-controllability",
  },
  {
    value: "4×",
    label: "More high-confidence binders than RFdiffusion and PepMLM, from about 100 labels",
    kind: "Wet-lab",
    source: "MDMI · NeurIPS 2025 workshop",
    to: "/research/mdmi",
  },
];

export const principles = [
  {
    title: "You own your models and data",
    body: "Models are built for you and run where you choose.",
  },
  {
    title: "Every step is traceable",
    body: "What ran, on which data, with which model version, so results can be reproduced and failures explained.",
  },
  {
    title: "Safety is part of the design",
    body: "We build toward sequence screening, customer vetting, and usage logging.",
  },
];

export const papers = [
  {
    slug: "aria-controllability",
    type: "Paper",
    title: "Controllability Across Composition, Topology, and Function in Language-Model Protein Generation",
    venue: "NeurIPS 2026",
    year: 2026,
    authors: "",
    kind: "In-silico",
    summary:
      "Aria instruction-tunes a language model on nearly 349k Swiss-Prot proteins, each described by a random subset of up to thirteen property descriptors in the prompt.",
    body: [
      "Protein language models generate plausible sequences, but directing them toward several user-specified properties at once is hard. We ask whether instruction tuning can give a general-purpose language model that control without training a protein model from scratch.",
      "On a leakage-controlled held-out set of 35,115 proteins, separated from training by MMseqs2 clustering, adherence improves on every recomputable axis. Length within ±10% rises from 11.6% to 88.8%, hydrophobicity from 62.4% to 86.9%, stability from 52.9% to 72.2%, and exact cysteine count from 23.3% to 68.9%. Transmembrane-helix MCC rises from 0.28 to 0.87, and signal-peptide MCC from 0.07 to 0.74.",
      "Exact Pfam-domain recovery improves over the base model but stays low overall, at 2.9%, and is strongly associated with how often a domain appeared in training.",
    ],
    limits: "These are computational measurements of sequence properties. Predicted structure confidence is not evidence that a protein folds or functions.",
    pdf: null,
  },
  {
    slug: "mdmi",
    type: "Paper",
    title: "Probing Functional Plasticity in Peptide–Protein Binding with Minimal Data",
    venue: "NeurIPS 2025 · AI4D3 workshop (spotlight)",
    year: 2025,
    authors: "Pouriya Bayat et al.",
    kind: "Wet-lab",
    summary:
      "MDMI combines AlphaFold-Multimer predictions, knowledge- and physics-based scoring, and a compact ML model to guide peptide optimization from about 100 labeled examples.",
    body: [
      "Machine learning has accelerated protein design, yet peptide discovery is still limited by scarce training data. Minimal Data · Maximal Insight (MDMI) is a structure-aware pipeline that integrates AlphaFold-Multimer predictions, knowledge- and physics-based scoring, and a compact ML model to guide peptide optimization.",
      "Using split GFP as a testbed, MDMI generated functional peptide binders with up to 63% sequence divergence from the wild type. Benchmarked against RFdiffusion and PepMLM, it produced fourfold more high-confidence binders while requiring nearly 100 labeled examples.",
    ],
    limits: "One experimental system, a friendly one. Results on therapeutic targets are not yet shown.",
    pdf: null,
  },
];

// X/Twitter handle for the daily biology news feed (no @). Empty until the account is connected.
export const NEWS_HANDLE = "BiologyAIDaily";

export const posts = []; // Blog posts go here. Empty on purpose until there is something real to say.

// Fill in linkedin / scholar URLs; a link shows only when set.
export const team = [
  { name: "Sepehr Bayat", role: "Co-founder", photo: asset("/team/sepehr.jpg"), pos: "24% 30%", zoom: 1.2, tx: "7%", ty: "9%", linkedin: "https://www.linkedin.com/in/sepehr-bayat-4369b98b/", scholar: "https://scholar.google.com/citations?hl=en&user=JUFknIcAAAAJ", bio: "PhD, Computer Science. Builds the AI systems." },
  { name: "Pouriya Bayat", role: "Co-founder", photo: asset("/team/pouriya.jpg"), pos: "52% 40%", zoom: 1.0, tx: "0%", ty: "0%", linkedin: "https://www.linkedin.com/in/pouriyabayat/", scholar: "https://scholar.google.com/citations?user=Lx8-mlMAAAAJ&hl=en", bio: "PhD, Pharmaceutical Sciences. Brings the biology and the bench." },
];

// Academic advisor. Name and title shown with her agreement; keep the title
// exactly as the university states it. A card with no photo falls back to initials.
export const advisors = [
  {
    name: "Mina Nouredanesh",
    role: "Academic advisor",
    photo: asset("/team/mina.jpg"),
    pos: "50% 30%", zoom: 1.0, tx: "0%", ty: "0%",
    affil: "Canada Research Chair in AI for Complex Health Data · Assistant Professor, University of Manitoba",
    linkedin: "https://www.linkedin.com/in/m-nouredanesh/",
    scholar: "https://scholar.google.com/citations?hl=en&user=SPAtFGQAAAAJ",
  },
];
