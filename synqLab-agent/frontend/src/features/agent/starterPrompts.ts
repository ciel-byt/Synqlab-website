/**
 * Starter prompts — compact ChatGPT-style suggestion chips.
 *
 * Each prompt is a short label and the full message sent on click.
 * Prompts differ by agent type: General gets science tool shortcuts,
 * Research Director gets orchestration-oriented prompts.
 */

export interface StarterPrompt {
  /** Short label rendered on the chip. */
  label: string
  /** The full message sent on click. */
  message: string
  /**
   * If set, clicking the chip navigates to this route instead of
   * creating an agent session. Used for demo flows that have their
   * own dedicated page.
   */
  demoRoute?: string
  /**
   * Docker compose service names this prompt typically needs running.
   * Surfaces as a small dot indicator on the chip.
   */
  requires?: string[]
}

/* ── General Research ─────────────────────────────────────────── */

// Demo setup: a single scenario (the GFP11 brightness run) is offered in every mode.
const PROMPTS: StarterPrompt[] = [
  {
    label: '✦ Design brighter GFP11 variants',
    message:
      'I have split-GFP assay brightness data for 113 GFP11 variants. Design a closed-loop optimization workflow that proposes new variants with higher fluorescence while preserving GFP1-10 binding and thermal stability. Use AlphaFold-Multimer for structure prediction. Run three rounds of 50 candidates each and return the top five for wet-lab validation.',
    demoRoute: '/lab/pipelines/gfp11-demo/run',
  },
]

export function getStarterPrompts(_agentType?: string, _pipelineMode?: boolean): StarterPrompt[] {
  return PROMPTS
}
