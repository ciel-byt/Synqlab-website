import { RefreshCw, Dna, Hexagon, FileText, PenLine, Newspaper, Info, Users } from "lucide-react";

// One icon per destination, all the same stroke and color (see --icon-tile-* in theme.css).
// Products each get a different glyph, not a different color.
const MAP = {
  synqlab: RefreshCw,
  aria: Dna,
  lyra: Hexagon,
  papers: FileText,
  blog: PenLine,
  news: Newspaper,
  about: Info,
  team: Users,
};

export function Icon({ name, size = 18 }) {
  const C = MAP[name];
  return C ? <C size={size} strokeWidth={1.6} aria-hidden="true" /> : null;
}
