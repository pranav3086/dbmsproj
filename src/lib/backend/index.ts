import type { Backend } from './types'

let instance: Backend | null = null
let pending: Promise<Backend> | null = null

/** Initialises the backend once. */
export function initBackend(onProgress?: (msg: string) => void): Promise<Backend> {
  pending ??= import('./api').then((m) => {
    onProgress?.('Connecting to the A10 Hospital server…')
    return (instance = m.createApiBackend())
  })
  return pending
}

/** The ready backend. The app renders routes only after initBackend() resolves. */
export function db(): Backend {
  if (!instance) throw new Error('Backend not initialised')
  return instance
}

export type { Backend } from './types'
