import { describe, expect, it } from 'vitest'
import { calculateWeeklyIncentives, getRecurringRowsToAdd, prorateSalary } from './calculations'

describe('salary and incentive calculations', () => {
  it('prorates salary over inclusive employment dates', () => {
    expect(prorateSalary(24000, '2026-08-14', null, 2026, 8)).toMatchObject({ workingDays: 18, amount: 13935 })
    expect(prorateSalary(25000, '2026-06-15', '2026-07-23', 2026, 6)).toMatchObject({ workingDays: 16, amount: 13333 })
    expect(prorateSalary(25000, '2026-06-15', '2026-07-23', 2026, 7)).toMatchObject({ workingDays: 23, amount: 18548 })
  })

  it('calculates incentive slabs with the existing four-week semantics', () => {
    const result = calculateWeeklyIncentives(
      [{ date: '2026-08-01', amount: 25000, car_id: 1 }],
      1,
      80000,
      500,
      250,
      5000,
      2026,
      8
    )
    expect(result.weeks[0].incentive).toBe(750)
    expect(result.totalIncentive).toBe(750)
  })

  it('dedupes recurring rows by category and car, preserving latest template values', () => {
    const toAdd = getRecurringRowsToAdd(
      [
        { date: '2026-06-01', category: 'emi', car_id: 1, amount: 10000, note: 'old' },
        { date: '2026-07-01', category: 'emi', car_id: 1, amount: 11000, note: 'corrected' },
        { date: '2026-07-01', category: 'emi', car_id: 2, amount: 9000, note: 'second car' },
      ],
      [{ date: '2026-08-01', category: 'emi', car_id: 1, amount: 11000, note: 'corrected' }],
      '2026-08-01'
    )
    expect(toAdd).toEqual([{ date: '2026-08-01', category: 'emi', car_id: 2, amount: 9000, note: 'second car' }])
  })
})
