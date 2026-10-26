import { describe, expect, it } from 'vitest'
import { assertIdent, sanitizeSearch } from '@/lib/backend/types'
import { addDaysKey, formatCalendarDate, hospitalDateKey, hospitalDayStartIso, initials } from '@/lib/utils'
import { safeNext } from '@/routes/guards'

describe('hospital time zone helpers (Asia/Kolkata, UTC+05:30)', () => {
  it('computes local midnight as a UTC instant', () => {
    expect(hospitalDayStartIso('2026-10-15')).toBe('2026-10-14T18:30:00.000Z')
  })
  it('derives the hospital calendar date of an instant', () => {
    expect(hospitalDateKey('2026-10-14T18:29:00Z')).toBe('2026-10-14')
    expect(hospitalDateKey('2026-10-14T18:31:00Z')).toBe('2026-10-15')
  })
  it('adds days across month ends', () => expect(addDaysKey('2026-10-31', 1)).toBe('2026-11-01'))
  it('formats calendar dates without shifting', () => expect(formatCalendarDate('1991-04-12')).toMatch(/12 Apr 1991/))
})

describe('input safety', () => {
  it('only allows plain identifiers in dynamic SQL', () => {
    expect(() => assertIdent('v_doctors')).not.toThrow()
    expect(() => assertIdent('doctors; drop table x')).toThrow()
    expect(() => assertIdent('"quoted"')).toThrow()
  })
  it('strips filter-syntax characters from search terms', () => {
    expect(sanitizeSearch('a,b(c)*%')).toBe('a b c')
  })
  it('only redirects to same-origin paths after sign-in', () => {
    expect(safeNext('/patient/dashboard')).toBe('/patient/dashboard')
    expect(safeNext('//evil.example')).toBeNull()
    expect(safeNext('https://evil.example')).toBeNull()
    expect(safeNext('/\\evil.example')).toBeNull()
  })
  it('makes initials without the Dr. prefix', () => expect(initials('Dr. Ananya Sample')).toBe('AS'))
})
