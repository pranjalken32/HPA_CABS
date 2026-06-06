import { useState } from 'react'

function toMonthStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function useMonthFilter() {
  const [month, setMonth] = useState(toMonthStr(new Date()))

  const startDate = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const endDate = `${y}-${String(m).padStart(2, '0')}-${String(
    new Date(y, m, 0).getDate()
  ).padStart(2, '0')}`

  return { month, setMonth, startDate, endDate }
}
