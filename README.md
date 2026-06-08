# HPA Cabs — Cab Business Finance Manager

A progressive web app (PWA) for managing cab business finances, built with React + TypeScript + Vite.

**Features:** Income tracking across platforms (Rapido/Ola/Uber/Cash), expense management, multi-car fleet management with document expiry tracking, cost recovery analysis, service history, weekly/monthly dashboards, and detailed analytics with automated alerts.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 8 + vite-plugin-pwa |
| Styling | Tailwind CSS (dark theme) |
| Data | Dexie.js (IndexedDB, offline-first) |
| Charts | Recharts |
| Icons | Lucide React |
| Routing | React Router (HashRouter) |

## Getting Started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # Production build in dist/
```

---

## Data Schema

```
incomes    { id, date, platform, amount, trips, note, carId? }
expenses   { id, date, category, amount, note, recurring, carId? }
cars       { id, name, number, totalCost, createdAt }
carDocuments   { id, carId, docType, expiryDate, note }
serviceRecords { id, carId, date, description, cost, odometerKm }
```

**Expense categories:** EMI, Fuel/CNG, Driver Salary, Driver Advance, Insurance, Permit/RTO, Toll/Parking, Car Wash, Other

**Platforms:** rapido, ola, uber, cash, other

---

## Analytics Calculation Logic

All analytics are computed client-side from IndexedDB data. Source: `src/pages/Analytics.tsx`

### 1. Time Range Selection

The user selects a range: **1M**, **2M**, **3M**, or **6M** (months).

```
numMonths = { '1m': 1, '2m': 2, '3m': 3, '6m': 6 }
startDate = first day of (currentMonth - numMonths + 1)
endDate   = last day of currentMonth
```

All income and expense records within `[startDate, endDate]` are queried from IndexedDB.

### 2. Key Performance Indicators (KPIs)

| KPI | Formula |
|-----|---------|
| **Total Revenue** | `SUM(income.amount)` for all records in range |
| **Total Expenses** | `SUM(expense.amount)` for all records in range |
| **Net Profit** | `totalRevenue - totalExpense` |
| **Total Trips** | `SUM(income.trips)` for all records in range |
| **Unique Working Days** | `COUNT(DISTINCT income.date)` — days with at least one income entry |
| **Avg Revenue / Day** | `totalRevenue / uniqueWorkingDays` |
| **Avg Trips / Day** | `totalTrips / uniqueWorkingDays` |
| **Revenue / Trip** | `totalRevenue / totalTrips` |
| **Profit Margin** | `(netProfit / totalRevenue) × 100` (%) |

### 3. Monthly Trend

For each month `M` in the selected range:

```
monthRevenue  = SUM(income.amount)  WHERE income.date starts with M
monthExpense  = SUM(expense.amount) WHERE expense.date starts with M
monthProfit   = monthRevenue - monthExpense
monthTrips    = SUM(income.trips)   WHERE income.date starts with M
```

Rendered as a **bar chart** (revenue vs expense) and an **area chart** (profit trend line).

### 4. Platform Performance

#### 4a. Platform Totals (across entire range)

```
For each platform P in {rapido, ola, uber, cash, other}:
  platformRevenue[P] = SUM(income.amount) WHERE income.platform == P
  platformTrips[P]   = SUM(income.trips)  WHERE income.platform == P
  revenuePerTrip[P]  = ROUND(platformRevenue[P] / platformTrips[P])
```

Sorted by revenue descending. Rendered as a **donut chart** + stat cards per platform.

#### 4b. Platform Monthly Comparison

For each month M, for each platform P:

```
platformMonthly[M][P] = SUM(income.amount) WHERE date ∈ M AND platform == P
```

Rendered as a **stacked bar chart** (platform colors per month).

### 5. Expense Breakdown

#### 5a. Category Totals

```
For each category C in {EMI, Fuel/CNG, Driver Salary, ...}:
  categoryTotal[C] = SUM(expense.amount) WHERE expense.category == C
  categoryPercent[C] = (categoryTotal[C] / totalExpense) × 100
```

Sorted by amount descending. Rendered as a **donut chart** + stat cards.

#### 5b. Expense Monthly Stacked

For each month M, for each category C:

```
expenseMonthly[M][C] = SUM(expense.amount) WHERE date ∈ M AND category == C
```

Rendered as a **stacked bar chart**.

### 6. Daily Patterns

#### 6a. Day-of-Week Analysis

```
For each day name D in {Mon, Tue, Wed, Thu, Fri, Sat, Sun}:
  dayRevenue[D]   = SUM(income.amount) WHERE dayOfWeek(income.date) == D
  dayTrips[D]     = SUM(income.trips)  WHERE dayOfWeek(income.date) == D
  daysWorked[D]   = COUNT(DISTINCT income records on day D)
  avgRevenue[D]   = ROUND(dayRevenue[D] / daysWorked[D])
  avgTrips[D]     = ROUND(dayTrips[D] / daysWorked[D])
```

Rendered as a **bar chart** + **7-column grid** showing avg revenue and trips per day.

#### 6b. Daily Revenue Timeline

```
For each unique date in the range:
  dailyRevenue[date] = SUM(income.amount) WHERE income.date == date
  dailyExpense[date] = SUM(expense.amount) WHERE expense.date == date
  dailyProfit[date]  = dailyRevenue - dailyExpense
```

Rendered as a **line chart** (green = revenue, red = expense).

### 7. Automated Alerts Engine

The system generates alerts based on these rules:

| Alert | Type | Condition | Message |
|-------|------|-----------|---------|
| **Low Revenue Days** | Warning | Any working day with revenue < ₹2,500 | `"X day(s) with revenue below ₹2,500 — worst: ₹Y"` |
| **Negative Profit Days** | Danger | Any day where `expense > revenue` | `"X day(s) with negative profit — total loss: ₹Y"` |
| **Off-Day Analysis** | Info | `totalPossibleDays - uniqueWorkingDays > 0` | `"X off-day(s) out of Y days — working Z% of the time"` |
| **High EMI Ratio** | Warning | `(EMI total / totalRevenue) > 15%` | `"EMI is X% of revenue — consider refinancing"` |
| **Best/Worst Platform** | Info | More than 1 platform used | `"Best platform: X (₹Y/trip) — Lowest: Z (₹W/trip)"` |
| **Best/Worst Day** | Info | Variation in day-of-week averages | `"Best day: X (avg ₹Y) — Slowest: Z (avg ₹W)"` |

```
totalPossibleDays = CEIL((endDate - startDate) / 86400000) + 1
daysOff = totalPossibleDays - uniqueWorkingDays
workingPercent = ROUND((uniqueWorkingDays / totalPossibleDays) × 100)
```

---

## Dashboard Calculations

Source: `src/pages/Dashboard.tsx`

### Monthly Overview

```
totalIncome  = SUM(income.amount) for selected month
totalExpense = SUM(expense.amount) for selected month
netProfit    = totalIncome - totalExpense
totalRevenue = totalIncome   (all platform income = revenue)
totalTrips   = SUM(income.trips) for selected month
```

### Weekly Breakdown

Weeks are calendar-based, dividing the month into 7-day blocks:

```
weekNumber(date) = CEIL(date.day / 7)
totalWeeks(year, month) = CEIL(lastDayOfMonth / 7)
weekRange(week) = ((week-1)*7 + 1) to MIN(week*7, lastDay)
```

For each week W (1 to totalWeeks):

```
weekIncome[W]  = SUM(income.amount) WHERE weekNumber(date) == W
weekExpense[W] = SUM(expense.amount) WHERE weekNumber(date) == W
weekTrips[W]   = SUM(income.trips) WHERE weekNumber(date) == W
weekProfit[W]  = weekIncome - weekExpense
```

Empty weeks (no data) display "No data yet". Each week card is expandable to show a **daily detail bar chart**.

### Platform Revenue Pie Chart

```
For each platform P:
  slice[P] = SUM(income.amount) WHERE platform == P AND date ∈ selectedMonth
```

### Expense Category Pie Chart

```
For each category C:
  slice[C] = SUM(expense.amount) WHERE category == C AND date ∈ selectedMonth
```

---

## Car Cost Recovery Calculations (Net Recovery)

Source: `src/pages/CarDetail.tsx`

### Recovery Tracker

```
totalCost        = car.totalCost             (purchase price + accessories)
grossIncome      = SUM(income.amount) WHERE income.carId == car.id
carExpenses      = SUM(expense.amount) WHERE expense.carId == car.id
totalServiceCost = SUM(serviceRecord.cost) WHERE serviceRecord.carId == car.id
netRecovered     = MAX(grossIncome - carExpenses - totalServiceCost, 0)
recoveryPercent  = MIN((netRecovered / totalCost) × 100, 100)
remaining        = MAX(totalCost - netRecovered, 0)
```

**Important:** To make expenses count toward a car's recovery, assign the car when adding the expense (fuel, EMI, etc.). Unassigned expenses don't affect car recovery.

### Estimated Time to Recover

```
monthsActive    = MAX((latestIncomeDate - earliestIncomeDate) / 30 days, 1)
monthlyAvg      = netRecovered / monthsActive
monthsToRecover = CEIL(remaining / monthlyAvg)
```

Only shown when `monthlyAvg > 0 AND remaining > 0`.

### Recovery Progress Ring

SVG circle with `circumference = 264` (radius 42 × 2π):

```
strokeDasharray = "${recoveryPercent × 2.64} 264"
color = recoveryPercent >= 100 ? green : white
```

---

## Dashboard Metrics

```
Revenue    = SUM(all income entries for the month)  — what shows on platform apps
Commission = SUM(expenses WHERE category == 'commission')
Income     = Revenue - Commission  — actual money received after platform cuts
Expenses   = SUM(non-commission expenses for the month)
Net Profit = Income - Expenses  — what you actually keep
```

---

## Document Expiry Logic

Source: `src/pages/CarDetail.tsx`

```
daysUntilExpiry = (expiryDate - today) / 86400000

Status:
  daysUntilExpiry < 0   → EXPIRED  (red)   "Expired X days ago"
  daysUntilExpiry ≤ 30  → WARNING  (yellow) "Expires in X days"
  daysUntilExpiry > 30  → VALID    (green)  "Valid until YYYY-MM-DD"
```

Document types: Insurance, Permit, PUC, Fitness Certificate, Road Tax, Registration (RC), Other.

Sorted by expiry date ascending (nearest expiry first).

---

## User & Role Management

### Roles

| Role | Access |
|------|--------|
| **owner** | Full access — Dashboard, Income, Expense, Cars, Drivers, Analytics, History |
| **driver** | Restricted — only sees own settlement (salary/advance) and fuel/CNG log |

### Adding a New Owner

1. Go to [Supabase Auth → Users](https://supabase.com/dashboard/project/ueiixjkfxbzyuknrkmtk/auth/users) → **Add user**
2. Enter email + password, check **"Auto Confirm User"** → **Create user**
3. Go to [SQL Editor](https://supabase.com/dashboard/project/ueiixjkfxbzyuknrkmtk/sql/new) and run:
```sql
insert into profiles (id, display_name, role)
select id, split_part(email, '@', 1), 'owner'
from auth.users
where id not in (select id from profiles);
```

### Adding a New Driver

1. Go to [Supabase Auth → Users](https://supabase.com/dashboard/project/ueiixjkfxbzyuknrkmtk/auth/users) → **Add user**
2. Enter email + password, check **"Auto Confirm User"** → **Create user**
3. Go to [SQL Editor](https://supabase.com/dashboard/project/ueiixjkfxbzyuknrkmtk/sql/new) and run:
```sql
insert into profiles (id, display_name, role)
select id, split_part(email, '@', 1), 'driver'
from auth.users
where id not in (select id from profiles);
```

### Changing Display Name

```sql
UPDATE profiles SET display_name = 'Arjun Singh' WHERE display_name = 'arjunsingh';
```

### Converting a User's Role

```sql
-- Make someone a driver
UPDATE profiles SET role = 'driver' WHERE display_name = 'username';

-- Make someone an owner
UPDATE profiles SET role = 'owner' WHERE display_name = 'username';
```

---

## Project Structure

```
src/
├── App.tsx                  # Router setup
├── main.tsx                 # Entry point
├── db.ts                    # Dexie schema + interfaces
├── index.css                # Tailwind + dark theme
├── seed.ts                  # Sample data generator
├── hooks/
│   └── useMonthFilter.ts    # Month picker state
├── components/
│   └── Layout.tsx           # Shell + bottom nav
└── pages/
    ├── Dashboard.tsx         # Monthly overview + weekly breakdown
    ├── Analytics.tsx         # Detailed analytics + alerts
    ├── AddIncome.tsx         # Income entry form
    ├── AddExpense.tsx        # Expense entry form
    ├── History.tsx           # Transaction history
    ├── Cars.tsx              # Car fleet list
    └── CarDetail.tsx         # Car detail (docs, recovery, service)
```

---

## License

Private — HPA Cabs
