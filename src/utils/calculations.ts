import { getInclusiveOverlapDays, lastDayOfMonth } from './date'

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
  month: number
): SalaryProration {
  const totalDays = lastDayOfMonth(year, month)
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`
  const workingDays = getInclusiveOverlapDays(
    startDate,
    endDate,
    `${monthPrefix}-01`,
    `${monthPrefix}-${String(totalDays).padStart(2, '0')}`
  )
  return {
    amount: Math.round((monthlySalary / totalDays) * workingDays),
    workingDays,
    totalDays,
  }
}

export interface WeekIncentive {
  weekNum: number
  revenue: number
  target: number
  incentive: number
  hit: boolean
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
  const weeklyTarget = incentiveTarget / 4
  const revenues: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const income of incomes) {
    if (income.car_id !== carId) continue
    const date = income.date
    const incomeYear = Number(date.slice(0, 4))
    const incomeMonth = Number(date.slice(5, 7))
    if (incomeYear !== year || incomeMonth !== month) continue
    const week = Math.min(Math.ceil(Number(date.slice(8, 10)) / 7), 4)
    revenues[week] += income.amount
  }

  const weeks: WeekIncentive[] = []
  let totalIncentive = 0
  for (let weekNum = 1; weekNum <= 4; weekNum++) {
    const revenue = revenues[weekNum]
    const hit = revenue >= weeklyTarget
    const incentive = !hit
      ? 0
      : incentiveSlab > 0
        ? incentiveBase + Math.floor((revenue - weeklyTarget) / incentiveSlab) * incentiveStep
        : incentiveBase
    weeks.push({ weekNum, revenue, target: weeklyTarget, incentive, hit })
    totalIncentive += incentive
  }
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
