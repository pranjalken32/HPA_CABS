import {
  getInclusiveOverlapDays,
  addLocalDays,
  getWeekEnd,
  getWeeksCoveringRange,
  getWeeksForMonth,
  lastDayOfMonth,
  type WeekRange,
} from './date'

export const DRIVER_PAID_CATEGORIES = ['driver_advance', 'driver_incentive'] as const

export function isDriverPaidExpense(
  expense: { category: string; driver_profile_id?: number | null; note?: string | null },
  driver: { id: number; name: string }
): boolean {
  if (!DRIVER_PAID_CATEGORIES.includes(expense.category as typeof DRIVER_PAID_CATEGORIES[number])) return false
  if (expense.driver_profile_id === driver.id) return true
  const name = driver.name.trim().toLowerCase()
  return name.length > 0 && (expense.note?.toLowerCase().includes(name) ?? false)
}

export interface SalaryProration {
  amount: number
  workingDays: number
  totalDays: number
}

export function prorateSalary(
  monthlySalary: number,
  startDate: string,
  endDate: string | null,
  year: number,
  month: number,
  periodEnd?: string
): SalaryProration {
  const totalDays = lastDayOfMonth(year, month)
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`
  const monthEnd = `${monthPrefix}-${String(totalDays).padStart(2, '0')}`
  const workingDays = getInclusiveOverlapDays(
    startDate,
    endDate,
    `${monthPrefix}-01`,
    periodEnd && periodEnd < monthEnd ? periodEnd : monthEnd
  )
  return {
    amount: Math.round((monthlySalary / totalDays) * workingDays),
    workingDays,
    totalDays,
  }
}

export interface WeeklySalaryProration {
  amount: number
  daysByMonth: Record<string, number>
}

export function prorateSalaryForWeek(
  monthlySalary: number,
  employmentStart: string,
  employmentEnd: string | null,
  week: WeekRange
): WeeklySalaryProration {
  const daysByMonth: Record<string, number> = {}
  let amount = 0
  let cursorMonth = week.start.slice(0, 7)
  const endMonth = week.end.slice(0, 7)

  while (cursorMonth <= endMonth) {
    const [year, month] = cursorMonth.split('-').map(Number)
    const monthStart = `${cursorMonth}-01`
    const monthEnd = `${cursorMonth}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`
    const periodStart = week.start > monthStart ? week.start : monthStart
    const periodEnd = week.end < monthEnd ? week.end : monthEnd
    if (periodStart <= periodEnd) {
      const days = getInclusiveOverlapDays(employmentStart, employmentEnd, periodStart, periodEnd)
      if (days > 0) {
        daysByMonth[cursorMonth] = days
        amount += (monthlySalary / lastDayOfMonth(year, month)) * days
      }
    }
    const nextMonth = month + 1
    const nextYear = year + (nextMonth > 12 ? 1 : 0)
    cursorMonth = `${nextYear}-${String(nextMonth > 12 ? 1 : nextMonth).padStart(2, '0')}`
  }

  return { amount: Math.round(amount * 100) / 100, daysByMonth }
}

export function getSettlementCarryForward(netPayable: number, settledAmount?: number): number {
  return settledAmount === undefined ? netPayable : netPayable - settledAmount
}

export interface WeeklyDriverProfile {
  id: number
  name: string
  start_date: string
  end_date: string | null
  monthly_salary: number
  car_id: number | null
  incentive_target: number
  incentive_base: number
  incentive_step: number
  incentive_slab: number
  daily_incentive_from?: string | null
  daily_incentive_slabs?: { revenue: number; incentive: number }[]
}

export interface DailyIncentiveSlab {
  revenue: number
  incentive: number
}

export interface DailyIncentiveDay {
  date: string
  revenue: number
  incentive: number
  source: 'slab' | 'manual'
}

export interface DailyIncentiveResult {
  totalIncentive: number
  days: DailyIncentiveDay[]
}

export function calculateDailyIncentive(
  revenue: number,
  slabs: DailyIncentiveSlab[]
): number {
  const reached = slabs
    .filter((slab) => slab.revenue <= revenue)
    .sort((left, right) => right.revenue - left.revenue)
  return reached[0]?.incentive ?? 0
}

export function calculateDailyIncentivesForRange(
  incomes: { date: string; amount: number; car_id: number | null }[],
  carId: number | null,
  slabs: DailyIncentiveSlab[],
  startDate: string,
  endDate: string,
  manualIncentives: { date: string; amount: number }[] = []
): DailyIncentiveResult {
  if (startDate > endDate) return { totalIncentive: 0, days: [] }
  const manualByDate = new Map(manualIncentives.map((entry) => [entry.date, entry.amount]))
  const days: DailyIncentiveDay[] = []
  for (let date = startDate; date <= endDate; date = addLocalDays(date, 1)) {
    const revenue = carId
      ? incomes
        .filter((income) => income.car_id === carId && income.date === date)
        .reduce((sum, income) => sum + income.amount, 0)
      : 0
    const manualAmount = manualByDate.get(date)
    days.push({
      date,
      revenue,
      incentive: manualAmount ?? calculateDailyIncentive(revenue, slabs),
      source: manualAmount === undefined ? 'slab' : 'manual',
    })
  }
  return {
    totalIncentive: days.reduce((sum, day) => sum + day.incentive, 0),
    days,
  }
}

export function calculateWeeklyIncentiveWithDailyRule(
  incomes: { date: string; amount: number; car_id: number | null }[],
  carId: number | null,
  incentiveTarget: number,
  incentiveBase: number,
  incentiveStep: number,
  incentiveSlab: number,
  week: WeekRange,
  dailyIncentiveFrom: string | null | undefined,
  dailyIncentiveSlabs: DailyIncentiveSlab[],
  manualIncentives: { date: string; amount: number }[]
): { incentive: number; dailyIncentives: DailyIncentiveDay[] } {
  const manualForWeek = manualIncentives.filter(
    (entry) => entry.date >= week.start && entry.date <= week.end
  )
  const weekly = calculateWeeklyIncentiveForRange(
    incomes,
    carId,
    incentiveTarget,
    incentiveBase,
    incentiveStep,
    incentiveSlab,
    week
  )
  if (!dailyIncentiveFrom || week.end < dailyIncentiveFrom) {
    if (manualForWeek.length === 0) return { incentive: weekly.incentive, dailyIncentives: [] }
    const manualDays = calculateDailyIncentivesForRange(
      incomes,
      carId,
      [],
      week.start,
      week.end,
      manualForWeek
    ).days.filter((day) => day.source === 'manual')
    return {
      incentive: weekly.incentive + manualForWeek.reduce((sum, entry) => sum + entry.amount, 0),
      dailyIncentives: manualDays,
    }
  }

  const dailyStart = week.start > dailyIncentiveFrom ? week.start : dailyIncentiveFrom
  const daily = calculateDailyIncentivesForRange(
    incomes,
    carId,
    dailyIncentiveSlabs,
    dailyStart,
    week.end,
    manualForWeek
  )
  const preCutoffManual = manualForWeek.filter((entry) => entry.date < dailyIncentiveFrom)
  const preCutoffManualDays = calculateDailyIncentivesForRange(
    incomes,
    carId,
    [],
    week.start,
    addLocalDays(dailyStart, -1),
    preCutoffManual
  ).days.filter((day) => day.source === 'manual')
  return {
    incentive: preCutoffManual.reduce((sum, entry) => sum + entry.amount, 0) + daily.totalIncentive,
    dailyIncentives: [...preCutoffManualDays, ...daily.days],
  }
}

export interface WeeklySettlementLike {
  id: number
  driver_name: string
  driver_profile_id: number | null
  amount: number
  period_type: 'month' | 'week' | null
  period_start: string
  period_end: string
  settled_date: string
}

export interface WeeklySettlementRow {
  weekStart: string
  weekEnd: string
  salary: number
  incentive: number
  advance: number
  basePayable: number
  carryForward: number
  netPayable: number
  projected: boolean
  settlement: WeeklySettlementLike | undefined
  coveringSettlement: WeeklySettlementLike | undefined
  coveringPeriodStart: string | undefined
  coveringPeriodEnd: string | undefined
  coverage: 'none' | 'weekly' | 'monthly' | 'partial'
  settleable: boolean
  dailyIncentives: DailyIncentiveDay[]
}

export function deriveWeeklySettlementRows(
  driver: WeeklyDriverProfile,
  incomes: { date: string; amount: number; car_id: number | null }[],
  expenses: { date: string; amount: number; category: string; driver_profile_id?: number | null; note?: string | null }[],
  settlements: WeeklySettlementLike[],
  asOfDate: string,
  manualIncentives: { date: string; amount: number }[] = []
): WeeklySettlementRow[] {
  const rangeEnd = driver.end_date && driver.end_date < asOfDate ? driver.end_date : asOfDate
  if (driver.start_date > rangeEnd) return []

  let carryForward = 0
  return getWeeksCoveringRange(driver.start_date, rangeEnd)
    .filter((week) => week.start <= getWeekEnd(asOfDate))
    .map((week) => {
      const exactSettlement = settlements.find(
        (candidate) => (candidate.period_type ?? 'month') === 'week' && candidate.period_start === week.start
      )
      const overlappingMonthlySettlements = settlements.filter(
        (candidate) => (
          (candidate.period_type ?? 'month') === 'month' &&
          candidate.period_start <= week.end &&
          candidate.period_end >= week.start
        )
      )
      const coveringSettlement = exactSettlement ? undefined : overlappingMonthlySettlements.find(
        (candidate) => candidate.period_start <= week.end && candidate.period_end >= week.end
      ) ?? overlappingMonthlySettlements[0]
      const weekDays = Array.from({ length: 7 }, (_, index) => addLocalDays(week.start, index))
      const coveredDays = new Set<string>()
      for (const settlement of overlappingMonthlySettlements) {
        for (const day of weekDays) {
          if (day >= settlement.period_start && day <= settlement.period_end) {
            coveredDays.add(day)
          }
        }
      }
      const fullyCovered = !exactSettlement &&
        coveredDays.size === weekDays.length
      const partiallyCovered = !exactSettlement &&
        coveredDays.size > 0 &&
        !fullyCovered
      const uncoveredRanges = partiallyCovered
        ? weekDays.reduce<{ start: string; end: string }[]>((ranges, day) => {
            if (coveredDays.has(day)) return ranges
            const previous = ranges.at(-1)
            if (previous && addLocalDays(previous.end, 1) === day) {
              previous.end = day
            } else {
              ranges.push({ start: day, end: day })
            }
            return ranges
          }, [])
        : []
      const salary = (partiallyCovered ? uncoveredRanges : [week]).reduce(
        (sum, range) => sum + prorateSalaryForWeek(
          driver.monthly_salary,
          driver.start_date,
          driver.end_date,
          range
        ).amount,
        0
      )
      const incentiveResult = partiallyCovered
        ? { incentive: 0, dailyIncentives: [] as DailyIncentiveDay[] }
        : calculateWeeklyIncentiveWithDailyRule(
          incomes,
          driver.car_id,
          driver.incentive_target,
          driver.incentive_base,
          driver.incentive_step,
          driver.incentive_slab,
          {
            start: week.start < driver.start_date ? driver.start_date : week.start,
            end: driver.end_date && driver.end_date < week.end ? driver.end_date : week.end,
          },
          driver.daily_incentive_from,
          driver.daily_incentive_slabs ?? [],
          manualIncentives
        )
      const incentive = incentiveResult.incentive
      const advance = expenses
        .filter((expense) => isDriverPaidExpense(expense, driver) && (partiallyCovered
          ? uncoveredRanges.some((range) => expense.date >= range.start && expense.date <= range.end)
          : expense.date >= week.start && expense.date <= week.end))
        .reduce((sum, expense) => sum + expense.amount, 0)
      const basePayable = fullyCovered ? 0 : salary + incentive - advance
      const coverage = exactSettlement
        ? 'weekly'
        : fullyCovered
          ? 'monthly'
          : partiallyCovered
            ? 'partial'
            : 'none'
      const row: WeeklySettlementRow = {
        weekStart: week.start,
        weekEnd: week.end,
        salary,
        incentive,
        advance,
        basePayable,
        carryForward: fullyCovered ? 0 : carryForward,
        netPayable: fullyCovered ? 0 : basePayable + carryForward,
        projected: week.end > asOfDate,
        settlement: exactSettlement,
        coveringSettlement,
        coveringPeriodStart: overlappingMonthlySettlements.length > 0
          ? overlappingMonthlySettlements.reduce(
            (start, settlement) => settlement.period_start < start ? settlement.period_start : start,
            overlappingMonthlySettlements[0].period_start
          )
          : undefined,
        coveringPeriodEnd: overlappingMonthlySettlements.length > 0
          ? overlappingMonthlySettlements.reduce(
            (end, settlement) => settlement.period_end > end ? settlement.period_end : end,
            overlappingMonthlySettlements[0].period_end
          )
          : undefined,
        coverage,
        settleable: !exactSettlement && overlappingMonthlySettlements.length === 0 && week.end <= asOfDate,
        dailyIncentives: incentiveResult.dailyIncentives,
      }
      carryForward = fullyCovered
        ? 0
        : getSettlementCarryForward(row.netPayable, exactSettlement?.amount)
      return row
    })
}

export interface WeekIncentive {
  weekNum: number
  weekStart: string
  weekEnd: string
  revenue: number
  target: number
  incentive: number
  hit: boolean
  dailyIncentives?: DailyIncentiveDay[]
}

export function calculateWeeklyIncentiveForRange(
  incomes: { date: string; amount: number; car_id: number | null }[],
  carId: number | null,
  incentiveTarget: number,
  incentiveBase: number,
  incentiveStep: number,
  incentiveSlab: number,
  week: WeekRange,
  weekNum = 1
): WeekIncentive {
  const weeklyTarget = incentiveTarget / 4
  const revenue = carId
    ? incomes
      .filter((income) => income.car_id === carId && income.date >= week.start && income.date <= week.end)
      .reduce((sum, income) => sum + income.amount, 0)
    : 0
  const hit = revenue >= weeklyTarget && weeklyTarget > 0
  const incentive = !hit
    ? 0
    : incentiveSlab > 0
      ? incentiveBase + Math.floor((revenue - weeklyTarget) / incentiveSlab) * incentiveStep
      : incentiveBase
  return { weekNum, weekStart: week.start, weekEnd: week.end, revenue, target: weeklyTarget, incentive, hit }
}

export function calculateWeeklyIncentives(
  incomes: { date: string; amount: number; car_id: number | null }[],
  carId: number | null,
  incentiveTarget: number,
  incentiveBase: number,
  incentiveStep: number,
  incentiveSlab: number,
  year: number,
  month: number,
  dailyIncentiveFrom?: string | null,
  dailyIncentiveSlabs: DailyIncentiveSlab[] = [],
  manualIncentives: { date: string; amount: number }[] = [],
  employmentStart?: string | null,
  employmentEnd?: string | null
): { weeks: WeekIncentive[]; totalIncentive: number } {
  if (!carId || (!dailyIncentiveFrom && incentiveTarget <= 0)) return { weeks: [], totalIncentive: 0 }
  const weeks = getWeeksForMonth(`${year}-${String(month).padStart(2, '0')}`)
    .map((week, index) => {
      const rangeStart = employmentStart && employmentStart > week.start ? employmentStart : week.start
      const rangeEnd = employmentEnd && employmentEnd < week.end ? employmentEnd : week.end
      if (rangeStart > rangeEnd) {
        return {
          weekNum: index + 1,
          weekStart: week.start,
          weekEnd: week.end,
          revenue: 0,
          target: incentiveTarget / 4,
          incentive: 0,
          hit: false,
          dailyIncentives: [],
        }
      }
      const range = { start: rangeStart, end: rangeEnd }
      const result = calculateWeeklyIncentiveWithDailyRule(
        incomes,
        carId,
        incentiveTarget,
        incentiveBase,
        incentiveStep,
        incentiveSlab,
        range,
        dailyIncentiveFrom,
        dailyIncentiveSlabs,
        manualIncentives
      )
      const revenue = incomes
        .filter((income) => income.car_id === carId && income.date >= rangeStart && income.date <= rangeEnd)
        .reduce((sum, income) => sum + income.amount, 0)
      return {
        weekNum: index + 1,
        weekStart: week.start,
        weekEnd: week.end,
        revenue,
        target: incentiveTarget / 4,
        incentive: result.incentive,
        hit: result.incentive > 0,
        dailyIncentives: result.dailyIncentives,
      }
    })
  const totalIncentive = weeks.reduce((sum, week) => sum + week.incentive, 0)
  return { weeks, totalIncentive }
}

export interface RecurringTemplate {
  date?: string
  category: string
  amount: number
  note: string
  car_id: number | null
}

export function getRecurringTemplates(rows: RecurringTemplate[]): RecurringTemplate[] {
  const templates = new Map<string, RecurringTemplate>()
  for (const row of rows) {
    const key = `${row.category}|${row.car_id ?? 'none'}`
    templates.set(key, row)
  }
  return [...templates.values()]
}

export function getRecurringRowsToAdd(
  templates: RecurringTemplate[],
  currentMonthRows: RecurringTemplate[],
  firstOfMonth: string
): RecurringTemplate[] {
  const existing = new Set(currentMonthRows.map((row) => `${row.category}|${row.car_id ?? 'none'}`))
  return getRecurringTemplates(templates)
    .filter((row) => !existing.has(`${row.category}|${row.car_id ?? 'none'}`))
    .map((row) => ({ ...row, date: firstOfMonth }))
}
