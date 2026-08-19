import { describe, expect, it } from 'vitest'
import {
  formatLocalDate,
  getInclusiveOverlapDays,
  isValidCalendarDate,
  lastDayOfMonth,
  lastDayOfMonthString,
  parseLocalDate,
} from './date'

describe('calendar date helpers', () => {
  it('rejects empty and impossible calendar dates', () => {
    expect(isValidCalendarDate('')).toBe(false)
    expect(isValidCalendarDate('2026-02-31')).toBe(false)
    expect(isValidCalendarDate('2026-13-01')).toBe(false)
    expect(isValidCalendarDate('2026-02-28')).toBe(true)
  })

  it('calculates month ends', () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28)
    expect(lastDayOfMonth(2024, 2)).toBe(29)
    expect(lastDayOfMonthString('2026-08')).toBe('2026-08-31')
  })

  it('keeps bare dates local and round trips them', () => {
    const date = parseLocalDate('2026-08-14')
    expect(formatLocalDate(date)).toBe('2026-08-14')
  })

  it('counts both employment endpoints', () => {
    expect(getInclusiveOverlapDays('2026-08-14', null, '2026-08-01', '2026-08-31')).toBe(18)
    expect(getInclusiveOverlapDays('2026-06-15', null, '2026-06-01', '2026-06-30')).toBe(16)
  })
})
