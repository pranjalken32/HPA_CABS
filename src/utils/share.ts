import type { IncomeRow, ExpenseRow } from '../supabase'

function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export function generateDailySummary(
  date: string,
  incomes: IncomeRow[],
  expenses: ExpenseRow[]
): string {
  const dayInc = incomes.filter((i) => i.date === date)
  const dayExp = expenses.filter((e) => e.date === date)
  const totalIncome = dayInc.reduce((s, i) => s + i.amount, 0)
  const totalExpense = dayExp.reduce((s, e) => s + e.amount, 0)
  const trips = dayInc.reduce((s, i) => s + i.trips, 0)

  const platformLines = Object.entries(
    dayInc.reduce<Record<string, number>>((acc, i) => {
      acc[i.platform] = (acc[i.platform] ?? 0) + i.amount
      return acc
    }, {})
  )
    .map(([p, amt]) => `  ${p}: ₹${fmt(amt)}`)
    .join('\n')

  return `📊 *HPA Cabs — ${date}*

💰 Revenue: ₹${fmt(totalIncome)}
💸 Expenses: ₹${fmt(totalExpense)}
📈 Net: ₹${fmt(totalIncome - totalExpense)}
🚗 Trips: ${trips}

*Platform Breakdown:*
${platformLines || '  No income recorded'}

---
_Sent from HPA Cabs App_`
}

export function generateWeeklySummary(
  weekLabel: string,
  incomes: IncomeRow[],
  expenses: ExpenseRow[]
): string {
  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0)
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0)
  const trips = incomes.reduce((s, i) => s + i.trips, 0)
  const daysWorked = new Set(incomes.map((i) => i.date)).size

  return `📊 *HPA Cabs — ${weekLabel}*

💰 Revenue: ₹${fmt(totalIncome)}
💸 Expenses: ₹${fmt(totalExpense)}
📈 Net Profit: ₹${fmt(totalIncome - totalExpense)}
🚗 Total Trips: ${trips}
📅 Days Worked: ${daysWorked}
💵 Avg/Day: ₹${fmt(daysWorked > 0 ? totalIncome / daysWorked : 0)}

---
_Sent from HPA Cabs App_`
}

export function generateMonthlySummary(
  month: string,
  incomes: IncomeRow[],
  expenses: ExpenseRow[]
): string {
  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0)
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0)
  const trips = incomes.reduce((s, i) => s + i.trips, 0)
  const daysWorked = new Set(incomes.map((i) => i.date)).size

  const catTotals = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount
    return acc
  }, {})

  const expenseLines = Object.entries(catTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amt]) => `  ${cat}: ₹${fmt(amt)}`)
    .join('\n')

  return `📊 *HPA Cabs — ${month} Summary*

💰 Revenue: ₹${fmt(totalIncome)}
💸 Expenses: ₹${fmt(totalExpense)}
📈 Net Profit: ₹${fmt(totalIncome - totalExpense)}
📊 Profit Margin: ${totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0}%
🚗 Total Trips: ${trips}
📅 Days Worked: ${daysWorked}

*Expense Breakdown:*
${expenseLines || '  No expenses recorded'}

---
_Sent from HPA Cabs App_`
}

export function shareViaWhatsApp(text: string) {
  const encoded = encodeURIComponent(text)
  window.open(`https://wa.me/?text=${encoded}`, '_blank')
}
