import Dexie, { type EntityTable } from 'dexie'

export interface Income {
  id: number
  date: string
  platform: string
  amount: number
  trips: number
  note: string
  carId?: number
}

export interface Expense {
  id: number
  date: string
  category: string
  amount: number
  note: string
  recurring: boolean
  carId?: number
}

export interface Car {
  id: number
  name: string
  number: string
  totalCost: number
  createdAt: string
}

export interface CarDocument {
  id: number
  carId: number
  docType: string
  expiryDate: string
  note: string
}

export interface ServiceRecord {
  id: number
  carId: number
  date: string
  description: string
  cost: number
  odometerKm: number
}

const db = new Dexie('CabManagerDB') as Dexie & {
  incomes: EntityTable<Income, 'id'>
  expenses: EntityTable<Expense, 'id'>
  cars: EntityTable<Car, 'id'>
  carDocuments: EntityTable<CarDocument, 'id'>
  serviceRecords: EntityTable<ServiceRecord, 'id'>
}

db.version(1).stores({
  incomes: '++id, date, platform',
  expenses: '++id, date, category',
})

db.version(2).stores({
  incomes: '++id, date, platform, carId',
  expenses: '++id, date, category, carId',
  cars: '++id',
  carDocuments: '++id, carId',
  serviceRecords: '++id, carId, date',
})

export { db }
