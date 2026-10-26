import { Compass } from 'lucide-react'
import { ButtonLink } from '@/components/common/Button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function NotFound() {
  useDocumentTitle('Page not found')
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mint-100 text-mint-600"><Compass className="h-8 w-8" /></span>
      <p className="mt-6 font-display text-6xl font-bold text-mint-300">404</p>
      <h1 className="mt-2 text-3xl font-semibold">We couldn’t find that page</h1>
      <p className="mt-3 max-w-md text-muted">The link may be outdated or the page may have moved.</p>
      <div className="mt-8 flex gap-3">
        <ButtonLink to="/">Go home</ButtonLink>
        <ButtonLink to="/doctors" variant="secondary">Find a doctor</ButtonLink>
      </div>
    </div>
  )
}
