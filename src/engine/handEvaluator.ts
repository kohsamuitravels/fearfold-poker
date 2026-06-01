// ============================================================
// FearFold Poker — Hand Evaluator
//
// Evaluates the best 5-card poker hand from any number of cards.
// Used for Texas Hold'em (2 hole + 5 community = best 5 of 7).
//
// Returns an EvaluatedHand with rank, name, tiebreakers[], bestFive[].
// Tiebreakers are compared lexicographically — higher is better.
// ============================================================

import { Card, EvaluatedHand, HandRank, HAND_RANK_NAMES, RANK_VALUES } from './types'

// Generate all combinations of k items from arr
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

function rankValue(card: Card): number {
  return RANK_VALUES[card.rank]
}

function groupByRank(cards: Card[]): Map<number, Card[]> {
  const map = new Map<number, Card[]>()
  for (const card of cards) {
    const v = rankValue(card)
    if (!map.has(v)) map.set(v, [])
    map.get(v)!.push(card)
  }
  return map
}

function groupBySuit(cards: Card[]): Map<string, Card[]> {
  const map = new Map<string, Card[]>()
  for (const card of cards) {
    if (!map.has(card.suit)) map.set(card.suit, [])
    map.get(card.suit)!.push(card)
  }
  return map
}

function sortDesc(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => rankValue(b) - rankValue(a))
}

/**
 * Evaluate exactly 5 cards.
 */
function evaluateFive(five: Card[]): EvaluatedHand {
  const sorted = sortDesc(five)
  const values = sorted.map(rankValue)
  const byRank = groupByRank(sorted)
  const bySuit = groupBySuit(sorted)
  const isFlush = bySuit.size === 1

  // Check straight (including A-2-3-4-5 wheel)
  const uniqueValues = [...new Set(values)].sort((a, b) => b - a)
  let isStraight = false
  let straightHigh = 0
  if (uniqueValues.length >= 5) {
    // Normal straight
    if (uniqueValues[0] - uniqueValues[4] === 4 && uniqueValues.length === 5) {
      isStraight = true
      straightHigh = uniqueValues[0]
    }
    // Wheel: A-2-3-4-5
    if (!isStraight) {
      const wheel = [14, 5, 4, 3, 2]
      const valueSet = new Set(values)
      if (wheel.every(v => valueSet.has(v))) {
        isStraight = true
        straightHigh = 5  // Five-high straight
      }
    }
  }

  const counts = [...byRank.values()].map(g => g.length).sort((a, b) => b - a)
  const isQuads    = counts[0] === 4
  const isFullHouse = counts[0] === 3 && counts[1] === 2
  const isTrips    = counts[0] === 3 && counts[1] !== 2
  const isTwoPair  = counts[0] === 2 && counts[1] === 2
  const isOnePair  = counts[0] === 2 && counts[1] !== 2

  // Determine hand rank and tiebreakers
  // Tiebreakers: array of numbers compared lexicographically.
  // First element is the hand rank category value.

  if (isStraight && isFlush) {
    const isRoyal = straightHigh === 14 && !values.includes(5)
    const rank = isRoyal ? HandRank.ROYAL_FLUSH : HandRank.STRAIGHT_FLUSH
    return {
      rank,
      name: HAND_RANK_NAMES[rank],
      tiebreakers: [rank, straightHigh],
      bestFive: sorted,
    }
  }

  if (isQuads) {
    const quadRank = [...byRank.entries()].find(([, g]) => g.length === 4)![0]
    const kicker  = [...byRank.entries()].find(([, g]) => g.length !== 4)![0]
    return {
      rank: HandRank.FOUR_OF_A_KIND,
      name: HAND_RANK_NAMES[HandRank.FOUR_OF_A_KIND],
      tiebreakers: [HandRank.FOUR_OF_A_KIND, quadRank, kicker],
      bestFive: sorted,
    }
  }

  if (isFullHouse) {
    const trioRank = [...byRank.entries()].find(([, g]) => g.length === 3)![0]
    const pairRank = [...byRank.entries()].find(([, g]) => g.length === 2)![0]
    return {
      rank: HandRank.FULL_HOUSE,
      name: HAND_RANK_NAMES[HandRank.FULL_HOUSE],
      tiebreakers: [HandRank.FULL_HOUSE, trioRank, pairRank],
      bestFive: sorted,
    }
  }

  if (isFlush) {
    return {
      rank: HandRank.FLUSH,
      name: HAND_RANK_NAMES[HandRank.FLUSH],
      tiebreakers: [HandRank.FLUSH, ...values],
      bestFive: sorted,
    }
  }

  if (isStraight) {
    return {
      rank: HandRank.STRAIGHT,
      name: HAND_RANK_NAMES[HandRank.STRAIGHT],
      tiebreakers: [HandRank.STRAIGHT, straightHigh],
      bestFive: sorted,
    }
  }

  if (isTrips) {
    const trioRank = [...byRank.entries()].find(([, g]) => g.length === 3)![0]
    const kickers = [...byRank.entries()]
      .filter(([, g]) => g.length !== 3)
      .map(([v]) => v)
      .sort((a, b) => b - a)
    return {
      rank: HandRank.THREE_OF_A_KIND,
      name: HAND_RANK_NAMES[HandRank.THREE_OF_A_KIND],
      tiebreakers: [HandRank.THREE_OF_A_KIND, trioRank, ...kickers],
      bestFive: sorted,
    }
  }

  if (isTwoPair) {
    const pairs = [...byRank.entries()]
      .filter(([, g]) => g.length === 2)
      .map(([v]) => v)
      .sort((a, b) => b - a)
    const kicker = [...byRank.entries()]
      .find(([, g]) => g.length === 1)![0]
    return {
      rank: HandRank.TWO_PAIR,
      name: HAND_RANK_NAMES[HandRank.TWO_PAIR],
      tiebreakers: [HandRank.TWO_PAIR, pairs[0], pairs[1], kicker],
      bestFive: sorted,
    }
  }

  if (isOnePair) {
    const pairRank = [...byRank.entries()].find(([, g]) => g.length === 2)![0]
    const kickers = [...byRank.entries()]
      .filter(([, g]) => g.length !== 2)
      .map(([v]) => v)
      .sort((a, b) => b - a)
    return {
      rank: HandRank.ONE_PAIR,
      name: HAND_RANK_NAMES[HandRank.ONE_PAIR],
      tiebreakers: [HandRank.ONE_PAIR, pairRank, ...kickers],
      bestFive: sorted,
    }
  }

  // High card
  return {
    rank: HandRank.HIGH_CARD,
    name: HAND_RANK_NAMES[HandRank.HIGH_CARD],
    tiebreakers: [HandRank.HIGH_CARD, ...values],
    bestFive: sorted,
  }
}

/**
 * Find the best 5-card hand from n cards (n >= 5).
 * For Texas Hold'em: pass 7 cards (2 hole + 5 community).
 */
export function evaluateBestHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    throw new Error(`Need at least 5 cards, got ${cards.length}`)
  }
  if (cards.length === 5) {
    return evaluateFive(cards)
  }
  const combos = combinations(cards, 5)
  let best: EvaluatedHand | null = null
  for (const combo of combos) {
    const evaluated = evaluateFive(combo)
    if (!best || compareHands(evaluated, best) > 0) {
      best = evaluated
    }
  }
  return best!
}

/**
 * Compare two evaluated hands.
 * Returns > 0 if a is better, < 0 if b is better, 0 if tie.
 */
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length)
  for (let i = 0; i < len; i++) {
    const av = a.tiebreakers[i] ?? 0
    const bv = b.tiebreakers[i] ?? 0
    if (av !== bv) return av - bv
  }
  return 0
}

/**
 * Rank multiple players by their hands.
 * Returns array of arrays: [[best players], [second best], ...]
 */
export function rankPlayers(
  playerHands: Array<{ playerId: string; cards: Card[] }>
): Array<Array<{ playerId: string; hand: EvaluatedHand }>> {
  const evaluated = playerHands.map(({ playerId, cards }) => ({
    playerId,
    hand: evaluateBestHand(cards),
  }))

  evaluated.sort((a, b) => compareHands(b.hand, a.hand))

  // Group ties
  const groups: Array<Array<{ playerId: string; hand: EvaluatedHand }>> = []
  for (const player of evaluated) {
    if (groups.length === 0 || compareHands(player.hand, groups[groups.length - 1][0].hand) < 0) {
      groups.push([player])
    } else {
      groups[groups.length - 1].push(player)
    }
  }
  return groups
}
