import { describe, expect, it } from 'vitest'
import {
  calculateDailyIncentive,
  calculateDailyIncentivesForRange,
  calculateWeeklyIncentiveForRange,
  calculateWeeklyIncentives,
  deriveWeeklySettlementRows,
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

  it('calculates the highest reached daily revenue slab', () => {
    const slabs = [
      { revenue: 4500, incentive: 650 },
      { revenue: 3000, incentive: 100 },
      { revenue: 4000, incentive: 400 },
      { revenue: 3500, incentive: 200 },
    ]
    expect([2999, 3000, 3499, 3500, 4000, 4499, 4500, 9000].map((revenue) =>
      calculateDailyIncentive(revenue, slabs)
    )).toEqual([0, 100, 100, 200, 400, 400, 650, 650])
    expect(calculateDailyIncentive(5000, [])).toBe(0)
  })

  it('lets manual daily incentives replace slab amounts, including zero', () => {
    const result = calculateDailyIncentivesForRange(
      [{ date: '2026-08-15', amount: 3029, car_id: 1 }],
      1,
      [{ revenue: 3000, incentive: 100 }],
      '2026-08-15',
      '2026-08-15',
      [{ date: '2026-08-15', amount: 0 }]
    )
    expect(result).toEqual({
      totalIncentive: 0,
      days: [{ date: '2026-08-15', revenue: 3029, incentive: 0, source: 'manual' }],
    })
  })

  it('uses manual entries before the daily cutoff and preserves old behavior with no cutoff', () => {
    const incomes = [{ date: '2026-08-02', amount: 25000, car_id: 1 }]
    const old = calculateWeeklyIncentiveForRange(incomes, 1, 80000, 500, 250, 5000, {
      start: '2026-08-02',
      end: '2026-08-08',
    })
    expect(calculateWeeklyIncentives(incomes, 1, 80000, 500, 250, 5000, 2026, 8).totalIncentive).toBe(750)
    expect(calculateWeeklyIncentives(
      incomes,
      1,
      80000,
      500,
      250,
      5000,
      2026,
      8,
      '2026-08-14',
      [],
      [{ date: '2026-08-02', amount: 300 }]
    ).weeks[0].incentive).toBe(1050)
    expect(old.incentive).toBe(750)
  })

  it('applies daily slabs on and after the effective date', () => {
    const incomes = [
      { date: '2026-08-14', amount: 814, car_id: 1 },
      { date: '2026-08-15', amount: 3029, car_id: 1 },
      { date: '2026-08-16', amount: 3006, car_id: 1 },
    ]
    const result = calculateWeeklyIncentives(
      incomes,
      1,
      90000,
      500,
      250,
      5000,
      2026,
      8,
      '2026-08-14',
      [
        { revenue: 3000, incentive: 100 },
        { revenue: 3500, incentive: 200 },
        { revenue: 4000, incentive: 400 },
        { revenue: 4500, incentive: 650 },
      ]
    )
    expect(calculateWeeklyIncentiveForRange(
      incomes,
      1,
      90000,
      500,
      250,
      5000,
      { start: '2026-08-10', end: '2026-08-16' }
    ).incentive).toBe(0)
    expect(result.weeks.find((week) => week.weekStart === '2026-08-10')?.incentive).toBe(200)
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

  it('derives Syed weekly settlement due and keeps the current week projected', () => {
    const rows = deriveWeeklySettlementRows(
      {
        id: 2,
        name: 'Syed',
        start_date: '2026-08-14',
        end_date: null,
        monthly_salary: 24000,
        car_id: 1,
        incentive_target: 90000,
        incentive_base: 500,
        incentive_step: 250,
        incentive_slab: 5000,
      },
      [
        { date: '2026-08-14', amount: 814, car_id: 1 },
        { date: '2026-08-15', amount: 3029, car_id: 1 },
        { date: '2026-08-16', amount: 3006, car_id: 1 },
        { date: '2026-08-17', amount: 2976, car_id: 1 },
        { date: '2026-08-18', amount: 2737, car_id: 1 },
      ],
      [
        { date: '2026-08-15', amount: 180, category: 'driver_advance', driver_profile_id: 2, note: '' },
        { date: '2026-08-16', amount: 200, category: 'driver_advance', driver_profile_id: 2, note: '' },
        { date: '2026-08-17', amount: 150, category: 'driver_advance', driver_profile_id: 2, note: '' },
        { date: '2026-08-18', amount: 366, category: 'driver_advance', driver_profile_id: 2, note: '' },
        { date: '2026-08-18', amount: 999, category: 'fare_fraud', driver_profile_id: null, note: 'fare fraud' },
      ],
      [],
      '2026-08-19'
    )

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      weekStart: '2026-08-10',
      weekEnd: '2026-08-16',
      salary: 2322.58,
      incentive: 0,
      advance: 380,
      basePayable: 1942.58,
      netPayable: 1942.58,
      projected: false,
    })
    expect(rows[1]).toMatchObject({
      weekStart: '2026-08-17',
      weekEnd: '2026-08-23',
      projected: true,
      settlement: undefined,
    })
    expect(rows[1].netPayable).toBeGreaterThan(rows[0].netPayable)
  })

  it('derives Syed daily slab incentives and payable amount', () => {
    const rows = deriveWeeklySettlementRows(
      {
        id: 2,
        name: 'Syed',
        start_date: '2026-08-14',
        end_date: null,
        monthly_salary: 24000,
        car_id: 1,
        incentive_target: 90000,
        incentive_base: 500,
        incentive_step: 250,
        incentive_slab: 5000,
        daily_incentive_from: '2026-08-14',
        daily_incentive_slabs: [
          { revenue: 3000, incentive: 100 },
          { revenue: 3500, incentive: 200 },
          { revenue: 4000, incentive: 400 },
          { revenue: 4500, incentive: 650 },
        ],
      },
      [
        { date: '2026-08-14', amount: 814, car_id: 1 },
        { date: '2026-08-15', amount: 3029, car_id: 1 },
        { date: '2026-08-16', amount: 3006, car_id: 1 },
        { date: '2026-08-17', amount: 2976, car_id: 1 },
        { date: '2026-08-18', amount: 2737, car_id: 1 },
        { date: '2026-08-19', amount: 2240, car_id: 1 },
        { date: '2026-08-20', amount: 3006, car_id: 1 },
        { date: '2026-08-21', amount: 2278, car_id: 1 },
        { date: '2026-08-22', amount: 2350, car_id: 1 },
        { date: '2026-08-24', amount: 2445, car_id: 1 },
        { date: '2026-08-25', amount: 1731, car_id: 1 },
        { date: '2026-08-26', amount: 2860, car_id: 1 },
        { date: '2026-08-27', amount: 1755, car_id: 1 },
        { date: '2026-08-28', amount: 2616, car_id: 1 },
        { date: '2026-08-29', amount: 3164, car_id: 1 },
      ],
      [
        { date: '2026-08-15', amount: 180, category: 'driver_advance', driver_profile_id: 2, note: '' },
        { date: '2026-08-16', amount: 200, category: 'driver_advance', driver_profile_id: 2, note: '' },
        { date: '2026-08-17', amount: 150, category: 'driver_advance', driver_profile_id: 2, note: '' },
        { date: '2026-08-18', amount: 366, category: 'driver_advance', driver_profile_id: 2, note: '' },
      ],
      [],
      '2026-08-19'
    )
    expect(rows[0]).toMatchObject({ incentive: 200, netPayable: 2142.58 })
    expect(rows[1]).toMatchObject({ incentive: 100, projected: true, settleable: false })
  })

  it('deducts driver incentive payouts but not salary expenses from weekly payable', () => {
    const driver = {
      id: 2,
      name: 'Syed Nawaz Ahmed',
      start_date: '2026-08-14',
      end_date: null,
      monthly_salary: 24000,
      car_id: 1,
      incentive_target: 90000,
      incentive_base: 500,
      incentive_step: 250,
      incentive_slab: 5000,
      daily_incentive_from: '2026-08-14',
      daily_incentive_slabs: [{ revenue: 3000, incentive: 100 }],
    }
    const incomes = [
      { date: '2026-08-15', amount: 3029, car_id: 1 },
      { date: '2026-08-16', amount: 3006, car_id: 1 },
    ]
    const weekNet = (expenses: { date: string; amount: number; category: string; driver_profile_id?: number | null; note?: string | null }[]) =>
      deriveWeeklySettlementRows(driver, incomes, expenses, [], '2026-08-19')
        .find((row) => row.weekStart === '2026-08-10')?.netPayable ?? 0
    const withoutPayout = weekNet([])

    expect(weekNet([{
      date: '2026-08-15',
      amount: 100,
      category: 'driver_incentive',
      driver_profile_id: 2,
      note: '',
    }])).toBeCloseTo(withoutPayout - 100, 2)
    expect(weekNet([{
      date: '2026-08-15',
      amount: 100,
      category: 'driver_incentive',
      driver_profile_id: null,
      note: '[Syed Nawaz Ahmed]',
    }])).toBeCloseTo(withoutPayout - 100, 2)
    expect(weekNet([{
      date: '2026-08-15',
      amount: 100,
      category: 'driver_salary',
      driver_profile_id: 2,
      note: '',
    }])).toBeCloseTo(withoutPayout, 2)
    expect(weekNet([{
      date: '2026-08-17',
      amount: 100,
      category: 'driver_incentive',
      driver_profile_id: 2,
      note: '',
    }])).toBeCloseTo(withoutPayout, 2)
  })

  it('bounds monthly incentive calculations to the employment window', () => {
    const augustIncome = [
      { date: '2026-08-15', amount: 3029, car_id: 1 },
      { date: '2026-08-16', amount: 3006, car_id: 1 },
    ]
    const departed = calculateWeeklyIncentives(
      augustIncome,
      1,
      90000,
      500,
      250,
      5000,
      2026,
      8,
      '2026-08-14',
      [{ revenue: 3000, incentive: 100 }],
      [],
      '2026-06-15',
      '2026-07-23'
    )
    expect(departed.totalIncentive).toBe(0)
    expect(departed.weeks.every((week) => week.revenue === 0 && week.incentive === 0)).toBe(true)

    const notStarted = calculateWeeklyIncentives(
      [{ date: '2026-06-20', amount: 25000, car_id: 1 }],
      1,
      80000,
      500,
      250,
      5000,
      2026,
      6,
      null,
      [],
      [],
      '2026-08-14',
      null
    )
    expect(notStarted.totalIncentive).toBe(0)

    const partial = calculateWeeklyIncentives(
      augustIncome,
      1,
      90000,
      500,
      250,
      5000,
      2026,
      8,
      '2026-08-14',
      [{ revenue: 3000, incentive: 100 }],
      [],
      '2026-08-16',
      null
    )
    expect(partial.weeks.find((week) => week.weekStart === '2026-08-10')).toMatchObject({
      revenue: 3006,
      incentive: 100,
    })
    expect(partial.totalIncentive).toBe(100)
  })

  it('recognises Arjun weeks covered by monthly settlements', () => {
    const rows = deriveWeeklySettlementRows(
      {
        id: 1,
        name: 'Arjun Singh',
        start_date: '2026-06-15',
        end_date: '2026-07-23',
        monthly_salary: 25000,
        car_id: 1,
        incentive_target: 90000,
        incentive_base: 500,
        incentive_step: 250,
        incentive_slab: 5000,
      },
      [],
      [
        { date: '2026-06-30', amount: 100, category: 'driver_advance', driver_profile_id: 1, note: '' },
        { date: '2026-07-02', amount: 200, category: 'driver_advance', driver_profile_id: 1, note: '' },
      ],
      [
        {
          id: 1,
          driver_name: 'Arjun Singh',
          driver_profile_id: 1,
          amount: 0,
          period_type: 'month',
          period_start: '2026-06-01',
          period_end: '2026-06-30',
          settled_date: '2026-07-01',
        },
        {
          id: 2,
          driver_name: 'Arjun Singh',
          driver_profile_id: 1,
          amount: 5538.54,
          period_type: 'month',
          period_start: '2026-07-01',
          period_end: '2026-07-31',
          settled_date: '2026-07-23',
        },
      ],
      '2026-08-19'
    )

    const partial = rows.find((row) => row.weekStart === '2026-06-29')
    expect(partial).toMatchObject({
      weekEnd: '2026-07-05',
      coverage: 'monthly',
      settleable: false,
      netPayable: 0,
      carryForward: 0,
    })
    expect(partial).toMatchObject({
      coveringPeriodStart: '2026-06-01',
      coveringPeriodEnd: '2026-07-31',
    })

    const covered = rows.filter((row) => row.weekStart >= '2026-07-06')
    expect(covered).toHaveLength(3)
    expect(covered.every((row) => (
      row.coverage === 'monthly' &&
      row.coveringSettlement?.period_start === '2026-07-01' &&
      !row.settleable &&
      row.netPayable === 0 &&
      row.carryForward === 0
    ))).toBe(true)
    expect(rows.filter((row) => row.settleable).reduce((sum, row) => sum + row.netPayable, 0)).toBe(0)
  })

  it('clips a genuinely partial week against the monthly settlement union', () => {
    const rows = deriveWeeklySettlementRows(
      {
        id: 1,
        name: 'Arjun Singh',
        start_date: '2026-06-29',
        end_date: '2026-07-23',
        monthly_salary: 25000,
        car_id: 1,
        incentive_target: 90000,
        incentive_base: 500,
        incentive_step: 250,
        incentive_slab: 5000,
      },
      [],
      [
        { date: '2026-06-30', amount: 100, category: 'driver_advance', driver_profile_id: 1, note: '' },
        { date: '2026-07-02', amount: 200, category: 'driver_advance', driver_profile_id: 1, note: '' },
      ],
      [{
        id: 2,
        driver_name: 'Arjun Singh',
        driver_profile_id: 1,
        amount: 5538.54,
        period_type: 'month',
        period_start: '2026-07-01',
        period_end: '2026-07-31',
        settled_date: '2026-07-23',
      }],
      '2026-08-19'
    )

    expect(rows[0]).toMatchObject({
      weekStart: '2026-06-29',
      weekEnd: '2026-07-05',
      coverage: 'partial',
      settleable: false,
      salary: 1666.67,
      incentive: 0,
      advance: 100,
      netPayable: 1566.67,
      coveringPeriodStart: '2026-07-01',
      coveringPeriodEnd: '2026-07-31',
    })
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
