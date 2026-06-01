// ============================================================
// Tests: Side Pot Calculator
// ============================================================

import { describe, it, expect } from 'vitest'
import { calculateSidePots, PotContribution } from '../../src/engine/sidePots'

describe('Side Pot Calculator', () => {
  it('creates a single pot with no all-ins', () => {
    const contributions: PotContribution[] = [
      { playerId: 'a', totalInPot: 100, isFolded: false },
      { playerId: 'b', totalInPot: 100, isFolded: false },
      { playerId: 'c', totalInPot: 100, isFolded: false },
    ]
    const pots = calculateSidePots(contributions)
    expect(pots.length).toBe(1)
    expect(pots[0].amount).toBe(300)
    expect(pots[0].eligiblePlayerIds).toContain('a')
    expect(pots[0].eligiblePlayerIds).toContain('b')
    expect(pots[0].eligiblePlayerIds).toContain('c')
  })

  it('creates side pot when one player is all-in for less', () => {
    // a is all-in for 50, b and c have 100 each
    const contributions: PotContribution[] = [
      { playerId: 'a', totalInPot: 50, isFolded: false },  // All-in short
      { playerId: 'b', totalInPot: 100, isFolded: false },
      { playerId: 'c', totalInPot: 100, isFolded: false },
    ]
    const pots = calculateSidePots(contributions)
    // Main pot: 50 * 3 = 150 — all eligible
    // Side pot: 50 * 2 = 100 — only b and c
    expect(pots.length).toBe(2)

    const mainPot = pots[0]
    expect(mainPot.amount).toBe(150)
    expect(mainPot.eligiblePlayerIds).toContain('a')
    expect(mainPot.eligiblePlayerIds).toContain('b')
    expect(mainPot.eligiblePlayerIds).toContain('c')

    const sidePot = pots[1]
    expect(sidePot.amount).toBe(100)
    expect(sidePot.eligiblePlayerIds).not.toContain('a')
    expect(sidePot.eligiblePlayerIds).toContain('b')
    expect(sidePot.eligiblePlayerIds).toContain('c')
  })

  it('creates multiple side pots with two all-ins', () => {
    // a: 30 (all-in), b: 60 (all-in), c: 100
    const contributions: PotContribution[] = [
      { playerId: 'a', totalInPot: 30, isFolded: false },
      { playerId: 'b', totalInPot: 60, isFolded: false },
      { playerId: 'c', totalInPot: 100, isFolded: false },
    ]
    const pots = calculateSidePots(contributions)
    // Level 1 (0-30): 30 * 3 = 90 — a, b, c
    // Level 2 (30-60): 30 * 2 = 60 — b, c
    // Level 3 (60-100): 40 * 1 = 40 — c only
    expect(pots.length).toBe(3)
    expect(pots[0].amount).toBe(90)
    expect(pots[0].eligiblePlayerIds.length).toBe(3)
    expect(pots[1].amount).toBe(60)
    expect(pots[1].eligiblePlayerIds.length).toBe(2)
    expect(pots[2].amount).toBe(40)
    expect(pots[2].eligiblePlayerIds.length).toBe(1)
    expect(pots[2].eligiblePlayerIds[0]).toBe('c')
  })

  it('handles folded player chips going to pot but not eligible', () => {
    // d folded after putting in 100; a, b, c also put in 100
    const contributions: PotContribution[] = [
      { playerId: 'a', totalInPot: 100, isFolded: false },
      { playerId: 'b', totalInPot: 100, isFolded: false },
      { playerId: 'c', totalInPot: 100, isFolded: false },
      { playerId: 'd', totalInPot: 100, isFolded: true },  // Folded
    ]
    const pots = calculateSidePots(contributions)
    expect(pots[0].amount).toBe(400)  // All chips in pot
    expect(pots[0].eligiblePlayerIds).not.toContain('d')
    expect(pots[0].eligiblePlayerIds.length).toBe(3)
  })

  it('handles zero contributions gracefully', () => {
    const contributions: PotContribution[] = []
    const pots = calculateSidePots(contributions)
    expect(pots).toEqual([])
  })

  it('handles single player (edge case)', () => {
    const contributions: PotContribution[] = [
      { playerId: 'a', totalInPot: 100, isFolded: false },
    ]
    const pots = calculateSidePots(contributions)
    expect(pots.length).toBe(1)
    expect(pots[0].amount).toBe(100)
  })

  it('total across all pots equals total contributions', () => {
    const contributions: PotContribution[] = [
      { playerId: 'a', totalInPot: 25, isFolded: false },
      { playerId: 'b', totalInPot: 50, isFolded: false },
      { playerId: 'c', totalInPot: 75, isFolded: true },
      { playerId: 'd', totalInPot: 100, isFolded: false },
    ]
    const pots = calculateSidePots(contributions)
    const total = pots.reduce((sum, p) => sum + p.amount, 0)
    const contributed = contributions.reduce((sum, c) => sum + c.totalInPot, 0)
    expect(total).toBe(contributed)
  })
})
