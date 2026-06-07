import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import AddIncome from './pages/AddIncome'
import AddExpense from './pages/AddExpense'
import History from './pages/History'
import Cars from './pages/Cars'
import CarDetail from './pages/CarDetail'
import Analytics from './pages/Analytics'
import DriverSettlement from './pages/DriverSettlement'
import Login from './pages/Login'
import { processRecurringExpenses } from './hooks/useSupabase'
import { runAllAlerts } from './utils/notifications'

export default function App() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (user) {
      processRecurringExpenses()
      runAllAlerts()
    }
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3 animate-pulse">
            H
          </div>
          <p className="text-text-muted text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/add-income" element={<AddIncome />} />
        <Route path="/add-expense" element={<AddExpense />} />
        <Route path="/history" element={<History />} />
        <Route path="/cars" element={<Cars />} />
        <Route path="/cars/:id" element={<CarDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/driver" element={<DriverSettlement />} />
      </Route>
    </Routes>
  )
}
