import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'

const BLOG_ITEMS: Array<{
  title: string
  category: 'Paper' | 'Case Study' | 'Engineering'
  summary: string
  readTime: string
  tags: string[]
  href: string
}> = [
  {
    title: 'Closed-loop protein design with assay-aware reranking',
    category: 'Paper',
    summary:
      'How to combine generation, structure prediction, and assay labels into a practical loop that improves after every round.',
    readTime: '9 min read',
    tags: ['Drug Discovery', 'Protein Design', 'Active Learning'],
    href: '#',
  },
  {
    title: 'From virtual screening to wet-lab shortlist in one workflow',
    category: 'Case Study',
    summary:
      'A realistic playbook for moving from large candidate sets to top compounds with fewer false positives and better budget control.',
    readTime: '7 min read',
    tags: ['Docking', 'Prioritization', 'Biotech Ops'],
    href: '#',
  },
  {
    title: 'Why failed candidates are first-class training data',
    category: 'Paper',
    summary:
      'Negative outcomes can drive better hit selection when captured systematically and fed back into model updates.',
    readTime: '6 min read',
    tags: ['ML for Biology', 'Data Strategy'],
    href: '#',
  },
  {
    title: 'Building reproducible discovery pipelines with multi-tenant labs',
    category: 'Engineering',
    summary:
      'Design patterns for secure organization-level isolation, collaborative teams, and traceable experiment histories.',
    readTime: '8 min read',
    tags: ['Platform', 'Security', 'MLOps'],
    href: '#',
  },
]

const CAT_TONE: Record<string, string> = {
  Paper: 'bg-primary/10 text-primary border-primary/20',
  'Case Study': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Engineering: 'bg-amber-50 text-amber-700 border-amber-200',
}

export function BlogPage() {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <nav className="sticky top-0 z-40 h-16 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-8">
          <Logo to="/landing" size="md" />
          <div className="flex items-center gap-2">
            <Link
              to="/landing"
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-border hover:text-foreground"
            >
              Back to site
            </Link>
            <a
              href="mailto:hello@synqlab.ai?subject=Demo%20Request&body=Hi%2C%20I%27d%20like%20to%20book%20a%20demo%20of%20SynqLab."
              className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Book a demo
            </a>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 pb-12 pt-16">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">SynqLab Blog</p>
        <h1 className="text-4xl tracking-tight text-foreground sm:text-5xl">
          Papers, case studies, and <span className="italic">discovery notes</span>
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          This page is designed to scale into a full publication hub: research papers, method comparisons,
          drug-discovery workflows, and engineering notes from real deployment environments.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {BLOG_ITEMS.map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${CAT_TONE[item.category]}`}>
                  {item.category}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground/70">{item.readTime}</span>
              </div>
              <h2 className="text-lg font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {item.tags.map((t) => (
                  <span key={t} className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                Open article <span aria-hidden>→</span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
