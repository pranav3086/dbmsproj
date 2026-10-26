import { useQuery } from '@tanstack/react-query'
import { getPublicSettings } from '@/services/directory'

export interface PublicSettings {
  hospital_name: string
  contact_phone: string
  contact_email: string
  emergency_phone: string
  address: string
  opening_hours: string
  cancellation_cutoff_hours: number
  pharmacy_delivery_fee: number
  pharmacy_free_delivery_over: number
  payments_mode: string
  timezone: string
}

/** Public hospital settings. Contact details are placeholders until verified values are configured. */
export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: getPublicSettings, staleTime: 5 * 60_000 }) as { data: PublicSettings | undefined; isLoading: boolean }
}

export const PLACEHOLDER_NOTE = 'Placeholder — verified contact details have not been configured yet.'
