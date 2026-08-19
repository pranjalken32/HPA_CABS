const DAY_MS = 24 * 60 * 60 * 1000

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const [year, month, day] = dateStr.split('-').map(Number)
  if (month < 1 || month > 12 || day < 1) return false
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function lastDayOfMonthString(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return `${month}-${String(lastDayOfMonth(year, monthNumber)).padStart(2, '0')}`
}

export function todayStr(): string {
  return formatLocalDate(new Date())
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

export function getInclusiveOverlapDays(
  employmentStart: string,
  employmentEnd: string | null,
  periodStart: string,
  periodEnd: string
): number {
  const start = Math.max(
    parseLocalDate(employmentStart).getTime(),
    parseLocalDate(periodStart).getTime()
  )
  const end = Math.min(
    parseLocalDate(employmentEnd ?? periodEnd).getTime(),
    parseLocalDate(periodEnd).getTime()
  )

  if (start > end) return 0
  return Math.round((end - start) / DAY_MS) + 1
}

export interface WeekRange {
  start: string
  end: string
}

export function addLocalDays(dateStr: string, days: number): string {
  const date = parseLocalDate(dateStr)
  date.setDate(date.getDate() + days)
  return formatLocalDate(date)
}

export function getWeekStart(dateStr: string): string {
  const date = parseLocalDate(dateStr)
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  return formatLocalDate(date)
}

export function getWeekEnd(dateStr: string): string {
  return addLocalDays(getWeekStart(dateStr), 6)
}

export function getWeeksCoveringRange(rangeStart: string, rangeEnd: string): WeekRange[] {
  if (rangeStart > rangeEnd) return []
  const weeks: WeekRange[] = []
  let weekStart = getWeekStart(rangeStart)
  const finalWeekStart = getWeekStart(rangeEnd)
  while (weekStart <= finalWeekStart) {
    weeks.push({ start: weekStart, end: addLocalDays(weekStart, 6) })
    weekStart = addLocalDays(weekStart, 7)
  }
  return weeks
}

export function getWeeksForMonth(month: string): WeekRange[] {
  const [year, monthNumber] = month.split('-').map(Number)
  const first = `${month}-01`
  const last = `${month}-${String(lastDayOfMonth(year, monthNumber)).padStart(2, '0')}`
  return getWeeksCoveringRange(first, last).filter((week) => week.end.slice(0, 7) === month)
}
