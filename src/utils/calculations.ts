import {
  getInclusiveOverlapDays,
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
