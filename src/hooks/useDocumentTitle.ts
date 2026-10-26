import { useEffect } from 'react'

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · A10 Hospital` : 'A10 Hospital — Exceptional Care. Thoughtfully Delivered.'
  }, [title])
}
