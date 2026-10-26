/**
 * Runtime configuration. The app talks to the A10 Hospital API server, which stores everything
 * in MySQL. Development tools (demo accounts on the sign-in page, the simulated mailbox) are on
 * unless VITE_DEMO_TOOLS=off.
 */
export const config = {
  mode: 'mysql' as const,
  siteUrl: (import.meta.env.VITE_SITE_URL as string | undefined) || (typeof window !== 'undefined' ? window.location.origin : ''),
  hospitalTimeZone: (import.meta.env.VITE_HOSPITAL_TIMEZONE as string | undefined) || 'Asia/Kolkata',
  currency: 'INR',
}

export const isDemo = import.meta.env.VITE_DEMO_TOOLS !== 'off'
