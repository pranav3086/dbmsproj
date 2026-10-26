import { AlertTriangle } from 'lucide-react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { LogoMark } from '@/components/common/Logo'

/** Error boundary for routes — also handles failed lazy-chunk loads after a redeploy. */
export function RouteError() {
  const error = useRouteError()
  const chunk = error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message)
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : chunk ? 'A new version of the site is available.' : 'An unexpected error occurred.'
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-mist px-6 text-center">
      <LogoMark className="h-12 w-12" />
      <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-error/10 text-error"><AlertTriangle className="h-6 w-6" /></div>
      <h1 className="mt-4 text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-muted">{message} Please reload the page. If the problem continues, contact the hospital.</p>
      <div className="mt-6 flex gap-3">
        <button onClick={() => window.location.reload()} className="rounded-xl bg-forest px-5 py-2.5 text-sm font-medium text-white">Reload</button>
        <a href="/" className="rounded-xl border border-line-strong bg-white px-5 py-2.5 text-sm font-medium text-forest">Go home</a>
      </div>
    </div>
  )
}
