// ============================================================
// FearFold Poker — Omaha Variant (Architecture Placeholder)
//
// Omaha rules:
// - Each player receives 4 hole cards (not 2)
// - Must use EXACTLY 2 hole cards and EXACTLY 3 community cards
// - Otherwise same betting structure as Texas Hold'em
//
// TODO Phase 5: Full Omaha implementation
// ============================================================

// import { Card, EvaluatedHand } from '../types'
// import { combinations } from '../handEvaluator'
// import { evaluateBestHand } from '../handEvaluator'

/**
 * TODO: Evaluate best Omaha hand.
 * Must use exactly 2 of 4 hole cards and exactly 3 of 5 community cards.
 *
 * Algorithm:
 * 1. Generate all C(4,2) = 6 combinations of 2 hole cards.
 * 2. Generate all C(5,3) = 10 combinations of 3 community cards.
 * 3. For each of the 60 combos, evaluate the 5-card hand.
 * 4. Return the best.
 */
export function evaluateOmahaHand(/* holeCards: Card[], communityCards: Card[] */): never {
  throw new Error('Omaha hand evaluation not yet implemented — coming in Phase 5')
}

export const OMAHA_HOLE_CARDS = 4
export const OMAHA_MIN_HOLE_CARDS_USED = 2
export const OMAHA_MAX_HOLE_CARDS_USED = 2
export const OMAHA_COMMUNITY_CARDS_USED = 3
