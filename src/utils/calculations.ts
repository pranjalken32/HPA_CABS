import {
  getInclusiveOverlapDays,
  getWeekEnd,
  getWeeksCoveringRange,
  getWeeksForMonth,
  lastDayOfMonth,
  type WeekRange,
} from './date'

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
}

export function deriveWeeklySettlementRows(
  driver: WeeklyDriverProfile,
  incomes: { date: string; amount: number; car_id: number | null }[],
  expenses: { date: string; amount: number; category: string; driver_profile_id?: number | null; note?: string | null }[],
  settlements: WeeklySettlementLike[],
  asOfDate: string
): WeeklySettlementRow[] {
  const rangeEnd = driver.end_date && driver.end_date < asOfDate ? driver.end_date : asOfDate
  if (driver.start_date > rangeEnd) return []

  let carryForward = 0
  return getWeeksCoveringRange(driver.start_date, rangeEnd)
    .filter((week) => week.start <= getWeekEnd(asOfDate))
    .map((week) => {
      const salary = prorateSalaryForWeek(
        driver.monthly_salary,
        driver.start_date,
        driver.end_date,
        week
      ).amount
      const incentive = calculateWeeklyIncentiveForRange(
        incomes,
        driver.car_id,
        driver.incentive_target,
        driver.incentive_base,
        driver.incentive_step,
        driver.incentive_slab,
        week
      ).incentive
      const advance = expenses
        .filter((expense) => expense.category === 'driver_advance' && (
          expense.driver_profile_id === driver.id ||
          expense.note?.toLowerCase().includes(driver.name.toLowerCase())
        ) && expense.date >= week.start && expense.date <= week.end)
        .reduce((sum, expense) => sum + expense.amount, 0)
      const settlement = settlements.find(
        (candidate) => (candidate.period_type ?? 'month') === 'week' && candidate.period_start === week.start
      )
      const basePayable = salary + incentive - advance
      const row: WeeklySettlementRow = {
        weekStart: week.start,
        weekEnd: week.end,
        salary,
        incentive,
        advance,
        basePayable,
        carryForward,
        netPayable: basePayable + carryForward,
        projected: week.end > asOfDate,
        settlement,
      }
      carryForward = getSettlementCarryForward(row.netPayable, settlement?.amount)
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
  month: number
): { weeks: WeekIncentive[]; totalIncentive: number } {
  if (!carId || incentiveTarget <= 0) return { weeks: [], totalIncentive: 0 }
  const weeks = getWeeksForMonth(`${year}-${String(month).padStart(2, '0')}`)
    .map((week, index) => calculateWeeklyIncentiveForRange(
      incomes,
      carId,
      incentiveTarget,
      incentiveBase,
      incentiveStep,
      incentiveSlab,
      week,
      index + 1
    ))
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
