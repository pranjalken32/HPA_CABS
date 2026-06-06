import { db } from './db'

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function dateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export async function seedData() {
  // Clear existing data
  await db.incomes.clear()
  await db.expenses.clear()
  await db.cars.clear()
  await db.carDocuments.clear()
  await db.serviceRecords.clear()

  // Add car: Swift Dzire, total cost = 6.4L + 10K accessories = 6,50,000
  const carId = await db.cars.add({
    name: 'Swift Dzire',
    number: 'MH12AB1234',
    totalCost: 650000,
    createdAt: '2026-04-01',
  })

  // Add car documents
  await db.carDocuments.bulkAdd([
    { carId, docType: 'Insurance', expiryDate: '2027-03-15', note: 'Comprehensive policy' },
    { carId, docType: 'Permit', expiryDate: '2026-09-30', note: 'State permit' },
    { carId, docType: 'PUC', expiryDate: '2026-08-20', note: '' },
    { carId, docType: 'Fitness Certificate', expiryDate: '2028-04-01', note: '' },
    { carId, docType: 'Registration (RC)', expiryDate: '2041-04-01', note: '' },
    { carId, docType: 'Road Tax', expiryDate: '2026-07-10', note: 'Expiring soon' },
  ])

  // Add service records
  await db.serviceRecords.bulkAdd([
    { carId, date: '2026-05-05', description: 'Oil change + filter', cost: 2800, odometerKm: 12500 },
    { carId, date: '2026-05-18', description: 'Tyre rotation', cost: 500, odometerKm: 14200 },
    { carId, date: '2026-06-02', description: 'AC gas refill', cost: 1500, odometerKm: 17800 },
  ])

  const platforms = ['rapido', 'ola', 'uber']
  const daysInMonth: Record<string, number> = {
    '2026-05': 31,
    '2026-06': 6, // up to today June 6
  }

  // Seed income for May and June 2026
  for (const [monthKey, totalDays] of Object.entries(daysInMonth)) {
    const [y, m] = monthKey.split('-').map(Number)
    for (let d = 1; d <= totalDays; d++) {
      // ~25 working days per month, some off days (Sundays or random)
      const dayOfWeek = new Date(y, m - 1, d).getDay()
      if (dayOfWeek === 0 && Math.random() < 0.7) continue // skip most Sundays

      // Daily revenue ₹3000-4000 split across 2-3 platforms
      const dailyRevenue = rand(3000, 4000)
      const numPlatforms = rand(2, 3)
      const chosenPlatforms = platforms.sort(() => Math.random() - 0.5).slice(0, numPlatforms)

      // Split revenue across platforms
      let remaining = dailyRevenue
      for (let p = 0; p < chosenPlatforms.length; p++) {
        const isLast = p === chosenPlatforms.length - 1
        const amount = isLast ? remaining : rand(Math.floor(remaining * 0.3), Math.floor(remaining * 0.6))
        remaining -= amount
        const trips = rand(3, 8)
        await db.incomes.add({
          date: dateStr(y, m, d),
          platform: chosenPlatforms[p],
          amount,
          trips,
          note: '',
          carId,
        })
      }

      // Some days have cash trips too (~30% chance)
      if (Math.random() < 0.3) {
        await db.incomes.add({
          date: dateStr(y, m, d),
          platform: 'cash',
          amount: rand(200, 600),
          trips: rand(1, 2),
          note: '',
          carId,
        })
      }
    }
  }

  // Seed expenses for May and June
  for (const [monthKey] of Object.entries(daysInMonth)) {
    const [y, m] = monthKey.split('-').map(Number)

    const days = daysInMonth[monthKey]

    // EMI - ₹12,000 on 5th of each month (only if within range)
    if (days >= 5) await db.expenses.add({
      date: dateStr(y, m, 5),
      category: 'EMI',
      amount: 12000,
      note: 'Monthly car EMI',
      recurring: true,
      carId,
    })

    // CNG refueling: every 2-3 days, 8kg × ₹95 = ₹760
    for (let d = 1; d <= days; d += rand(2, 3)) {
      await db.expenses.add({
        date: dateStr(y, m, Math.min(d, days)),
        category: 'Fuel / CNG',
        amount: 760, // 8kg × ₹95
        note: 'CNG refill 8kg',
        recurring: false,
        carId,
      })
    }

    // Driver salary - ₹10,000 on 1st
    await db.expenses.add({
      date: dateStr(y, m, 1),
      category: 'Driver Salary',
      amount: 10000,
      note: 'Monthly driver salary',
      recurring: true,
      carId,
    })

    // Driver advance - occasional
    if (Math.random() < 0.5 && days >= 10) {
      await db.expenses.add({
        date: dateStr(y, m, rand(10, Math.min(20, days))),
        category: 'Driver Advance',
        amount: rand(1000, 3000),
        note: 'Advance payment',
        recurring: false,
        carId,
      })
    }

    // Car wash - twice a month
    await db.expenses.add({
      date: dateStr(y, m, rand(1, Math.min(10, days))),
      category: 'Car Wash',
      amount: rand(300, 500),
      note: '',
      recurring: false,
      carId,
    })
    if (days > 15) {
      await db.expenses.add({
        date: dateStr(y, m, rand(15, Math.min(25, days))),
        category: 'Car Wash',
        amount: rand(300, 500),
        note: '',
        recurring: false,
        carId,
      })
    }

    // Toll/Parking - a few times per month
    const tollCount = Math.min(rand(3, 6), days)
    for (let t = 0; t < tollCount; t++) {
      await db.expenses.add({
        date: dateStr(y, m, rand(1, days)),
        category: 'Toll / Parking',
        amount: rand(50, 200),
        note: '',
        recurring: false,
        carId,
      })
    }

    // Maintenance - occasional in May
    if (monthKey === '2026-05' && days >= 18) {
      await db.expenses.add({
        date: dateStr(y, m, 18),
        category: 'Maintenance',
        amount: 2500,
        note: 'Minor service',
        recurring: false,
        carId,
      })
    }
  }

  console.log('Seed data loaded successfully!')
}
