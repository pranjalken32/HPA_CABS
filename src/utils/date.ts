const DAY_MS = 24 * 60 * 60 * 1000

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
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
