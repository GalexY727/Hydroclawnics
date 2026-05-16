// src/useFarm3D.test.js
import { describe, it, expect } from 'vitest'
import { deriveStage, deriveHealth } from './useFarm3D'

describe('deriveStage', () => {
  it('returns 0 for age_hours < 12', () => expect(deriveStage(11)).toBe(0))
  it('returns 0 for age_hours = 0', () => expect(deriveStage(0)).toBe(0))
  it('returns 1 for age_hours = 12 (boundary)', () => expect(deriveStage(12)).toBe(1))
  it('returns 1 for age_hours = 35', () => expect(deriveStage(35)).toBe(1))
  it('returns 2 for age_hours = 36 (boundary)', () => expect(deriveStage(36)).toBe(2))
  it('returns 2 for age_hours = 59', () => expect(deriveStage(59)).toBe(2))
  it('returns 3 for age_hours = 60 (boundary)', () => expect(deriveStage(60)).toBe(3))
  it('returns 3 for age_hours = 200', () => expect(deriveStage(200)).toBe(3))
  it('defaults to 1 for undefined', () => expect(deriveStage(undefined)).toBe(1))
  it('defaults to 1 for NaN', () => expect(deriveStage(NaN)).toBe(1))
})

describe('deriveHealth', () => {
  it('returns 0.9 for "healthy"', () => expect(deriveHealth('healthy')).toBe(0.9))
  it('returns 0.55 for "warning"', () => expect(deriveHealth('warning')).toBe(0.55))
  it('returns 0.2 for "critical"', () => expect(deriveHealth('critical')).toBe(0.2))
  it('defaults to 0.8 for unknown string', () => expect(deriveHealth('unknown')).toBe(0.8))
  it('defaults to 0.8 for undefined', () => expect(deriveHealth(undefined)).toBe(0.8))
  it('defaults to 0.8 for null', () => expect(deriveHealth(null)).toBe(0.8))
})
