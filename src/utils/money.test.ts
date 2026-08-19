import { describe, expect, it } from 'vitest'
import { parseNonNegativeNumber, parsePositiveAmount } from './money'

describe('numeric input helpers', () => {
  it('rejects invalid or non-positive money', () => {
    expect(parsePositiveAmount('')).toBeNull()
    expect(parsePositiveAmount('not a number')).toBeNull()
    expect(parsePositiveAmount('Infinity')).toBeNull()
    expect(parsePositiveAmount('0')).toBeNull()
    expect(parsePositiveAmount('12.50')).toBe(12.5)
  })

  it('rejects invalid optional numbers without coercing them to zero', () => {
    expect(parseNonNegativeNumber('bad')).toBeNull()
    expect(parseNonNegativeNumber('')).toBeNull()
    expect(parseNonNegativeNumber('0')).toBe(0)
  })
})
