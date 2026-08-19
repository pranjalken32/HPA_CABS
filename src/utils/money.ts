export function parsePositiveAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const amount = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

export function parseNonNegativeNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const amount = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

export function fmt(value: number): string {
  return Math.abs(value).toLocaleString('en-IN')
}
