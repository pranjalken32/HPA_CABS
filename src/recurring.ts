import { db } from './db'

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * On app load, auto-generate recurring expenses for the current month.
 *
 * Logic:
 * 1. Find all expenses marked as recurring
 * 2. Group by (category, amount, note) to identify unique templates
 * 3. For the current month, check if a matching recurring expense already exists
 * 4. If not, create one dated to the 1st of the current month
 */
export async function processRecurringExpenses() {
  const month = currentMonth()
  const firstOfMonth = `${month}-01`

  const allRecurring = await db.expenses
    .filter((e) => e.recurring)
    .toArray()

  // Build unique templates keyed by "category|amount|note"
  const templates = new Map<string, { category: string; amount: number; note: string; carId?: number }>()
  for (const e of allRecurring) {
    const key = `${e.category}|${e.amount}|${e.note}`
    if (!templates.has(key)) {
      templates.set(key, { category: e.category, amount: e.amount, note: e.note, carId: e.carId })
    }
  }

  // Check which templates already have an entry this month
  const thisMonthStart = `${month}-01`
  const thisMonthEnd = `${month}-31`
  const thisMonthExpenses = await db.expenses
    .where('date')
    .between(thisMonthStart, thisMonthEnd, true, true)
    .filter((e) => e.recurring)
    .toArray()

  const existingKeys = new Set(
    thisMonthExpenses.map((e) => `${e.category}|${e.amount}|${e.note}`)
  )

  // Auto-generate missing recurring entries
  const toAdd = []
  for (const [key, tmpl] of templates) {
    if (!existingKeys.has(key)) {
      toAdd.push({
        date: firstOfMonth,
        category: tmpl.category,
        amount: tmpl.amount,
        note: tmpl.note,
        recurring: true,
        carId: tmpl.carId,
      })
    }
  }

  if (toAdd.length > 0) {
    await db.expenses.bulkAdd(toAdd)
  }

  return toAdd.length
}
