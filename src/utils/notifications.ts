import { supabase } from '../supabase'

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function showNotification(title: string, body: string) {
  if (Notification.permission !== 'granted') return
  new Notification(title, {
    body,
    icon: '/HPA_CABS/icon-192.png',
    badge: '/HPA_CABS/icon-192.png',
  })
}

export async function checkDocExpiryAlerts() {
  const { data: docs } = await supabase.from('car_documents').select('*, cars(name)')

  if (!docs) return

  const today = new Date()
  const in7Days = new Date(today)
  in7Days.setDate(in7Days.getDate() + 7)
  const in30Days = new Date(today)
  in30Days.setDate(in30Days.getDate() + 30)

  const alerts: string[] = []

  for (const doc of docs) {
    const expiry = new Date(doc.expiry_date)
    const carName = (doc.cars as { name: string } | null)?.name ?? 'Car'

    if (expiry < today) {
      alerts.push(`${doc.doc_type} for ${carName} has EXPIRED!`)
    } else if (expiry <= in7Days) {
      alerts.push(`${doc.doc_type} for ${carName} expires in ${Math.ceil((expiry.getTime() - today.getTime()) / 86400000)} days`)
    } else if (expiry <= in30Days) {
      alerts.push(`${doc.doc_type} for ${carName} expires in ${Math.ceil((expiry.getTime() - today.getTime()) / 86400000)} days`)
    }
  }

  if (alerts.length > 0) {
    showNotification(
      'HPA Cabs - Document Alert',
      alerts.slice(0, 3).join('\n')
    )
  }

  return alerts
}

export async function checkEMIDueAlert() {
  const today = new Date()
  if (today.getDate() > 3) return // Only alert near start of month

  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const firstOfMonth = `${month}-01`
  const lastOfMonth = `${month}-31`

  const { data: emiThisMonth } = await supabase
    .from('expenses')
    .select('*')
    .eq('category', 'emi')
    .gte('date', firstOfMonth)
    .lte('date', lastOfMonth)

  if (!emiThisMonth || emiThisMonth.length === 0) {
    const { data: anyEmi } = await supabase
      .from('expenses')
      .select('*')
      .eq('category', 'emi')
      .eq('recurring', true)
      .limit(1)

    if (anyEmi && anyEmi.length > 0) {
      showNotification(
        'HPA Cabs - EMI Reminder',
        `EMI of ₹${anyEmi[0].amount.toLocaleString('en-IN')} is due this month`
      )
    }
  }
}

export async function runAllAlerts() {
  const granted = await requestNotificationPermission()
  if (!granted) return
  await checkDocExpiryAlerts()
  await checkEMIDueAlert()
}
