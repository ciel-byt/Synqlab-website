/**
 * LyraPage — placeholder for the small-molecule specialist agent (in development).
 */

import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { RequestForm } from '@/features/requests/RequestForm'

export function LyraPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <PageHeader
        title="Lyra"
        description="The small-molecule specialist agent. It brings the same customization loop to small molecules, on the same platform."
        badge={<Badge variant="outline">In development</Badge>}
      />
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <h3 className="font-serif text-2xl font-medium">Tell us what you need</h3>
        <RequestForm
          source="lyra-interest"
          intro="Lyra is not available yet. Describe the small-molecule problem you are working on and we will get in touch when it is ready, or sooner if we can help."
        />
      </div>
    </div>
  )
}
