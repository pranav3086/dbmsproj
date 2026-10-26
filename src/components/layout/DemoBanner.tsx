import { FlaskConical } from 'lucide-react'
import { Link } from 'react-router'
import { isDemo } from '@/lib/config'

/** Always-visible notice in development builds: the data is synthetic sample data. */
export function DemoBanner() {
  if (!isDemo) return null
  return (
    <div className="no-print relative z-50 bg-[#fdf6e7] text-[12.5px] text-[#7a5413]">
      <div className="container-page flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-1.5 text-center">
        <span className="inline-flex items-center gap-1.5 font-semibold"><FlaskConical className="h-3.5 w-3.5" /> Demo build</span>
        <span>Fictional sample data in a local MySQL database — never enter real health information.</span>
        <Link to="/dev/mailbox" className="font-semibold underline underline-offset-2">Demo mailbox</Link>
      </div>
    </div>
  )
}
