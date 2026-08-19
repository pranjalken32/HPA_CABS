import { describe, expect, it } from 'vitest'
import {
  calculateWeeklyIncentiveForRange,
  calculateWeeklyIncentives,
  getSettlementCarryForward,
  getRecurringRowsToAdd,
  prorateSalary,
  prorateSalaryForWeek,
} from './calculations'
import { getWeeksCoveringRange, getWeeksForMonth } from './date'

describe('salary and incentive calculations', () => {
  it('prorates salary over inclusive employment dates', () => {
    expect(prorateSalary(24000, '2026-08-14', null, 2026, 8)).toMatchObject({ workingDays: 18, amount: 13935 })
    expect(prorateSalary(25000, '2026-06-15', '2026-07-23', 2026, 6)).toMatchObject({ workingDays: 16, amount: 13333 })
    expect(prorateSalary(25000, '2026-06-15', '2026-07-23', 2026, 7)).toMatchObject({ workingDays: 23, amount: 18548 })
  })

  it('uses the viewed month period for till-date salary calculations', () => {
    expect(prorateSalary(24000, '2026-06-15', null, 2026, 8, '2026-08-19')).toMatchObject({
      workingDays: 19,
    })
    expect(prorateSalary(24000, '2026-08-14', null, 2026, 8, '2026-08-19')).toMatchObject({
      workingDays: 6,
    })
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

  it('prorates a whole week at the calendar month daily rate', () => {
    expect(prorateSalaryForWeek(24000, '2026-08-01', null, {
      start: '2026-08-03',
      end: '2026-08-09',
    })).toEqual({ amount: 5419.35, daysByMonth: { '2026-08': 7 } })
  })

  it('splits a week across calendar months', () => {
    expect(prorateSalaryForWeek(24000, '2026-08-01', null, {
      start: '2026-08-31',
      end: '2026-09-06',
    })).toEqual({
      amount: 5574.19,
      daysByMonth: { '2026-08': 1, '2026-09': 6 },
    })
  })

  it('counts only employed days in partial and departed weeks', () => {
    expect(prorateSalaryForWeek(24000, '2026-08-14', null, {
      start: '2026-08-10',
      end: '2026-08-16',
    }).amount).toBe(2322.58)
    expect(prorateSalaryForWeek(25000, '2026-06-15', '2026-07-23', {
      start: '2026-07-20',
      end: '2026-07-26',
    }).amount).toBe(3225.81)
  })

  it('sums weekly salary slices back to the monthly proration', () => {
    const monthWeeks = getWeeksCoveringRange('2026-08-01', '2026-08-31')
    const weeklyTotal = monthWeeks.reduce(
      (sum, week) => sum + prorateSalaryForWeek(24000, '2026-08-01', null, {
        start: week.start < '2026-08-01' ? '2026-08-01' : week.start,
        end: week.end > '2026-08-31' ? '2026-08-31' : week.end,
      }).amount,
      0
    )
    expect(Math.round(weeklyTotal)).toBe(prorateSalary(24000, '2026-08-01', null, 2026, 8).amount)
  })

  it('attributes incentive revenue to the real week containing its Sunday month', () => {
    const incomes = [{ date: '2026-08-31', amount: 20000, car_id: 1 }]
    const august = calculateWeeklyIncentives(incomes, 1, 80000, 500, 250, 5000, 2026, 8)
    const september = calculateWeeklyIncentives(incomes, 1, 80000, 500, 250, 5000, 2026, 9)
    expect(august.totalIncentive).toBe(0)
    expect(september.weeks[0].revenue).toBe(20000)
    expect(calculateWeeklyIncentiveForRange(
      [{ date: '2026-08-30', amount: 20000, car_id: 1 }],
      1,
      80000,
      500,
      250,
      5000,
      getWeeksForMonth('2026-08').at(-1)!
    ).revenue).toBe(20000)
  })

  it('carries the residual when a settlement differs from the computed payable', () => {
    expect(getSettlementCarryForward(1250, 1000)).toBe(250)
    expect(getSettlementCarryForward(1250)).toBe(1250)
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
