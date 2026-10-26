import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { LogoMark } from '@/components/common/Logo'
import { initBackend } from '@/lib/backend'
import { errorMessage } from '@/lib/utils'
import { router } from '@/routes/router'
import { AuthProvider } from './auth'
import { CartProvider } from './cart'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

function Splash({ message, error }: { message: string; error?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-mist px-6 text-center" role="status" aria-live="polite">
      <div className="relative">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-mint-300/40 [animation-duration:2s]" aria-hidden />
        <LogoMark className="relative h-14 w-14" />
      </div>
      <p className="mt-6 font-display text-lg font-semibold text-forest">A10 Hospital</p>
      {error ? (
        <div className="mt-3 max-w-md">
          <p className="text-sm text-error">{error}</p>
          <button className="mt-4 rounded-xl bg-forest px-5 py-2.5 text-sm font-medium text-white" onClick={() => window.location.reload()}>Reload</button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">{message}</p>
      )}
    </div>
  )
}

export function App() {
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('Loading…')
  const [error, setError] = useState<string>()

  useEffect(() => {
    initBackend(setMessage)
      .then(() => setReady(true))
      .catch((e) => setError(`The application could not start: ${errorMessage(e)}`))
  }, [])

  if (!ready) return <Splash message={message} error={error} />

  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <RouterProvider router={router} />
            <Toaster position="top-right" richColors closeButton toastOptions={{ classNames: { toast: 'font-sans rounded-2xl' } }} />
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MotionConfig>
  )
}
