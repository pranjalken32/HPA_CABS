import { describe, expect, it } from 'vitest'
import {
  formatLocalDate,
  getWeekEnd,
  getInclusiveOverlapDays,
  getWeekStart,
  getWeeksCoveringRange,
  getWeeksForMonth,
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

  it('finds Monday-to-Sunday weeks across month and year boundaries', () => {
    expect(getWeekStart('2026-01-01')).toBe('2025-12-29')
    expect(getWeekEnd('2026-01-01')).toBe('2026-01-04')
    expect(getWeekStart('2026-01-04')).toBe('2025-12-29')
    expect(getWeeksCoveringRange('2025-12-31', '2026-01-05')).toEqual([
      { start: '2025-12-29', end: '2026-01-04' },
      { start: '2026-01-05', end: '2026-01-11' },
    ])
  })

  it('attributes month weeks by their Sunday', () => {
    const weeks = getWeeksForMonth('2026-08')
    expect(weeks[0]).toEqual({ start: '2026-07-27', end: '2026-08-02' })
    expect(weeks.at(-1)).toEqual({ start: '2026-08-24', end: '2026-08-30' })
    expect(weeks.every((week) => week.end.startsWith('2026-08'))).toBe(true)
  })
})
