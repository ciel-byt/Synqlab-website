import { useEffect, useState } from "react";
import { papers as fallback } from "./content.js";

// The research list comes from the product's database (GET /api/public/papers).
// If the API is not there (e.g. `npm run dev` without the backend) we fall back to the short list in content.js.
const fromContent = fallback.map((p) => ({ ...p, kind: "Paper", topic: "Protein AI", abstract: p.summary, doi: null, url: null }));

let cache = null;
let inflight = null;

function load() {
  if (cache) return Promise.resolve(cache);
  inflight ||= fetch("/api/public/papers")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((rows) => (cache = Array.isArray(rows) && rows.length ? rows : fromContent))
    .catch(() => (cache = fromContent));
  return inflight;
}

export function usePapers() {
  const [state, setState] = useState({ papers: cache || [], loading: !cache });
  useEffect(() => {
    let live = true;
    load().then((papers) => live && setState({ papers, loading: false }));
    return () => { live = false; };
  }, []);
  return state;
}

export const SCHOLAR_URL = "https://scholar.google.com/citations?user=Lx8-mlMAAAAJ&hl=en";
