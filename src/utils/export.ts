import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { IncomeRow, ExpenseRow } from '../supabase'

const CATEGORY_LABELS: Record<string, string> = {
  emi: 'EMI',
  fuel: 'Fuel / CNG',
  driver_salary: 'Driver Salary',
  driver_advance: 'Driver Advance',
  insurance: 'Insurance',
  permit: 'Permit / RTO',
  toll: 'Toll / Parking',
  car_wash: 'Car Wash',
  other: 'Other',
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export function exportToExcel(
  month: string,
  incomes: IncomeRow[],
  expenses: ExpenseRow[]
) {
  const wb = XLSX.utils.book_new()

  // Income sheet
  const incData = incomes.map((i) => ({
    Date: i.date,
    Platform: i.platform,
    Amount: i.amount,
    Trips: i.trips,
    Note: i.note,
  }))
  const incSheet = XLSX.utils.json_to_sheet(incData)
  XLSX.utils.book_append_sheet(wb, incSheet, 'Income')

  // Expense sheet
  const expData = expenses.map((e) => ({
    Date: e.date,
    Category: CATEGORY_LABELS[e.category] ?? e.category,
    Amount: e.amount,
    Recurring: e.recurring ? 'Yes' : 'No',
    Note: e.note,
  }))
  const expSheet = XLSX.utils.json_to_sheet(expData)
  XLSX.utils.book_append_sheet(wb, expSheet, 'Expenses')

  // Summary sheet
  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0)
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0)
  const catTotals = expenses.reduce<Record<string, number>>((acc, e) => {
    const label = CATEGORY_LABELS[e.category] ?? e.category
    acc[label] = (acc[label] ?? 0) + e.amount
    return acc
  }, {})

  const summaryData = [
    { Metric: 'Total Revenue', Value: totalIncome },
    { Metric: 'Total Expenses', Value: totalExpense },
    { Metric: 'Net Profit', Value: totalIncome - totalExpense },
    { Metric: 'Total Trips', Value: incomes.reduce((s, i) => s + i.trips, 0) },
    { Metric: '', Value: '' },
    { Metric: '--- Expense Breakdown ---', Value: '' },
    ...Object.entries(catTotals).map(([k, v]) => ({ Metric: k, Value: v })),
  ]
  const sumSheet = XLSX.utils.json_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, sumSheet, 'Summary')

  XLSX.writeFile(wb, `HPA_Cabs_${month}.xlsx`)
}

export function exportToPDF(
  month: string,
  incomes: IncomeRow[],
  expenses: ExpenseRow[]
) {
  const doc = new jsPDF()
  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0)
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0)
  const netProfit = totalIncome - totalExpense

  // Header
  doc.setFontSize(20)
  doc.setTextColor(108, 92, 231)
  doc.text('HPA Cabs', 14, 20)
  doc.setFontSize(12)
  doc.setTextColor(100)
  doc.text(`Profit & Loss Statement — ${month}`, 14, 28)

  // Summary box
  doc.setFontSize(11)
  doc.setTextColor(0)
  const summaryY = 38
  doc.text(`Total Revenue:   Rs ${fmt(totalIncome)}`, 14, summaryY)
  doc.text(`Total Expenses:  Rs ${fmt(totalExpense)}`, 14, summaryY + 7)
  doc.setTextColor(netProfit >= 0 ? 0 : 200, netProfit >= 0 ? 150 : 0, 0)
  doc.text(`Net Profit:      Rs ${fmt(netProfit)}`, 14, summaryY + 14)
  doc.text(`Total Trips:     ${incomes.reduce((s, i) => s + i.trips, 0)}`, 14, summaryY + 21)

  // Income table
  doc.setTextColor(0)
  let y = summaryY + 32
  doc.setFontSize(13)
  doc.text('Income', 14, y)
  y += 2

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Platform', 'Amount', 'Trips', 'Note']],
    body: incomes.map((i) => [i.date, i.platform, `Rs ${fmt(i.amount)}`, String(i.trips), i.note]),
    theme: 'striped',
    headStyles: { fillColor: [108, 92, 231] },
    styles: { fontSize: 9 },
  })

  // Expense table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10
  doc.setFontSize(13)
  doc.text('Expenses', 14, y)
  y += 2

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Category', 'Amount', 'Recurring', 'Note']],
    body: expenses.map((e) => [
      e.date,
      CATEGORY_LABELS[e.category] ?? e.category,
      `Rs ${fmt(e.amount)}`,
      e.recurring ? 'Yes' : 'No',
      e.note,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [255, 82, 82] },
    styles: { fontSize: 9 },
  })

  // Expense breakdown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10
  const catTotals = expenses.reduce<Record<string, number>>((acc, e) => {
    const label = CATEGORY_LABELS[e.category] ?? e.category
    acc[label] = (acc[label] ?? 0) + e.amount
    return acc
  }, {})

  doc.setFontSize(13)
  doc.text('Expense Breakdown', 14, y)
  y += 2

  autoTable(doc, {
    startY: y,
    head: [['Category', 'Amount', '% of Total']],
    body: Object.entries(catTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, amt]) => [
        cat,
        `Rs ${fmt(amt)}`,
        `${totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : 0}%`,
      ]),
    theme: 'striped',
    headStyles: { fillColor: [249, 115, 22] },
    styles: { fontSize: 9 },
  })

  doc.save(`HPA_Cabs_${month}.pdf`)
}
