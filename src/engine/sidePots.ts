// ============================================================
// FearFold Poker — Side Pot Calculator
//
// When one or more players are all-in, we need to create
// separate pots where only players who contributed enough
// are eligible to win.
//
// Algorithm:
// 1. Sort players by totalInPot ascending.
// 2. For each "level", create a pot from contributions up to
//    that player's level, among all players who contributed >= level.
// ============================================================

import { PlayerState, SidePot } from './types'

export interface PotContribution {
  playerId: string
  totalInPot: number
  isFolded: boolean
}

/**
 * Calculate side pots from player contributions.
 *
 * @param contributions - Each active player's total contribution to the pot.
 * @returns Array of SidePots, from main pot to side pots.
 */
export function calculateSidePots(contributions: PotContribution[]): SidePot[] {
  // Only non-zero contributors
  const active = contributions.filter(c => c.totalInPot > 0)
  if (active.length === 0) return []

  // Sort by amount ascending to process all-in levels
  const sorted = [...active].sort((a, b) => a.totalInPot - b.totalInPot)

  const sidePots: SidePot[] = []
  let prevLevel = 0

  for (let i = 0; i < sorted.length; i++) {
    const level = sorted[i].totalInPot
    if (level === prevLevel) continue  // Duplicate level (shouldn't happen, but guard)

    const levelAmount = level - prevLevel
    
    // Players who contributed at least this level
    const eligible = active
      .filter(c => c.totalInPot >= level && !c.isFolded)
      .map(c => c.playerId)

    // All players who contributed at this level (for computing pot size)
    const contributors = active.filter(c => c.totalInPot >= level)

    // Special case: if only folded players contributed at this level,
    // their chips still go into the last pot (they can't win, but chips are there)
    const allContributors = active.filter(c => c.totalInPot >= level)

    const potAmount = levelAmount * allContributors.length

    if (potAmount > 0) {
      // Merge with last pot if eligible players are the same
      const last = sidePots[sidePots.length - 1]
      if (
        last &&
        eligible.length === last.eligiblePlayerIds.length &&
        eligible.every(id => last.eligiblePlayerIds.includes(id))
      ) {
        last.amount += potAmount
      } else {
        sidePots.push({ amount: potAmount, eligiblePlayerIds: eligible })
      }
    }

    prevLevel = level
  }

  return sidePots
}

/**
 * Convenience: build PotContribution[] from PlayerState[]
 */
export function playerStatesToContributions(players: PlayerState[]): PotContribution[] {
  return players.map(p => ({
    playerId: p.playerId,
    totalInPot: p.totalInPot,
    isFolded: p.status === 'FOLDED',
  }))
}
