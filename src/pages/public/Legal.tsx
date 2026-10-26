import type { ReactNode } from 'react'
import { PageHeader } from '@/components/common/Layout'
import { SampleBadge } from '@/components/common/Badge'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  useDocumentTitle(title)
  return (
    <div className="container-page max-w-3xl py-12 sm:py-16">
      <PageHeader title={title} breadcrumbs={[{ label: 'Home', to: '/' }, { label: title }]} />
      <SampleBadge label="Template — requires legal review before launch" />
      <div className="prose-a10 mt-8 space-y-8 text-[15.5px]">{children}</div>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  )
}
