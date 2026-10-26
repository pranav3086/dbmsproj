import { motion, useReducedMotion } from 'motion/react'
import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { LoadingSkeleton } from '@/components/common/States'
import { DemoBanner } from './DemoBanner'
import { PublicFooter } from './PublicFooter'
import { PublicNavbar } from './PublicNavbar'

export function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, hash])
  return null
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
  return (
    <motion.div key={pathname} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  )
}

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <PublicNavbar />
      <main id="main" className="flex-1">
        <Suspense fallback={<div className="container-page py-16"><LoadingSkeleton variant="detail" rows={6} /></div>}>
          <PageTransition><Outlet /></PageTransition>
        </Suspense>
      </main>
      <PublicFooter />
    </div>
  )
}
