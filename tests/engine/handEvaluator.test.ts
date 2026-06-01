// ============================================================
// Tests: Hand Evaluator
// ============================================================

import { describe, it, expect } from 'vitest'
import { evaluateBestHand, compareHands, rankPlayers } from '../../src/engine/handEvaluator'
import { Card, HandRank } from '../../src/engine/types'

function c(rank: string, suit: string): Card {
  return { rank: rank as Card['rank'], suit: suit as Card['suit'] }
}

describe('Hand Evaluator', () => {
  // ─── Basic Rankings ──────────────────────────────────────

  it('detects Royal Flush', () => {
    const cards = [c('A','spades'), c('K','spades'), c('Q','spades'), c('J','spades'), c('10','spades')]
    const hand = evaluateBestHand(cards)
    expect(hand.rank).toBe(HandRank.ROYAL_FLUSH)
  })

  it('detects Straight Flush', () => {
    const cards = [c('9','hearts'), c('8','hearts'), c('7','hearts'), c('6','hearts'), c('5','hearts')]
    const hand = evaluateBestHand(cards)
    expect(hand.rank).toBe(HandRank.STRAIGHT_FLUSH)
    expect(hand.tiebreakers[1]).toBe(9)
  })

  it('detects Four of a Kind', () => {
    const cards = [c('A','spades'), c('A','hearts'), c('A','diamonds'), c('A','clubs'), c('K','spades')]
    const hand = evaluateBestHand(cards)
    expect(hand.rank).toBe(HandRank.FOUR_OF_A_KIND)
  })

  it('detects Full House', () => {
    const cards = [c('K','spades'), c('K','hearts'), c('K','diamonds'), c('Q','clubs'), c('Q','spades')]
    const hand = evaluateBestHand(cards)
    expect(hand.rank).toBe(HandRank.FULL_HOUSE)
  })

  it('detects Flush', () => {
    const cards = [c('A','diamonds'), c('J','diamonds'), c('9','diamonds'), c('5','diamonds'), c('2','diamonds')]
    const hand = evaluateBestHand(cards)
    expect(hand.rank).toBe(HandRank.FLUSH)
  })

  it('detects Straight', () => {
    const cards = [c('8','clubs'), c('7','hearts'), c('6','diamonds'), c('5','spades'), c('4','clubs')]
    const hand = evaluateBestHand(cards)
    expect(hand.rank).toBe(HandRank.STRAIGHT)
    expect(hand.tiebreakers[1]).toBe(8)
  })

  it('detects wheel (A-2-3-4-5 straight)', () => {
    const cards = [c('A','spades'), c('2','hearts'), c('3','diamonds'), c('4','clubs'), c('5','spades')]
    const hand = evaluateBestHand(cards)
    expect(hand.rank).toBe(HandRank.STRAIGHT)
    expect(hand.tiebreakers[1]).toBe(5)  // Five-high
  })

  it('detects Three of a Kind', () => {
    const cards = [c('7','spades'), c('7','hearts'), c('7','diamonds'), c('K','clubs'), c('2','spades')]
    const hand = evaluateBestHand(cards)
    expect(hand.rank).toBe(HandRank.THREE_OF_A_KIND)
  })

  it('detects Two Pair', () => {
    const cards = [c('A','spades'), c('A','hearts'), c('K','diamonds'), c('K','clubs'), c('Q','spades')]
    const hand = evaluateBestHand(cards)
    expect(hand.rank).toBe(HandRank.TWO_PAIR)
  })

  it('detects One Pair', () => {
    const cards = [c('J','spades'), c('J','hearts'), c('A','diamonds'), c('K','clubs'), c('Q','spades')]
    const hand = evaluateBestHand(cards)
    expect(hand.rank).toBe(HandRank.ONE_PAIR)
  })

  it('detects High Card', () => {
    const cards = [c('A','spades'), c('K','hearts'), c('Q','diamonds'), c('J','clubs'), c('9','spades')]
    const hand = evaluateBestHand(cards)
    expect(hand.rank).toBe(HandRank.HIGH_CARD)
  })

  // ─── Best 5 of 7 ─────────────────────────────────────────

  it('finds best 5 of 7 cards (Texas Hold\'em)', () => {
    // Hole: A♠ K♠   Board: Q♠ J♠ 10♠ 2♥ 3♦  → Royal Flush
    const cards = [
      c('A','spades'), c('K','spades'),
      c('Q','spades'), c('J','spades'), c('10','spades'), c('2','hearts'), c('3','diamonds')
    ]
    const hand = evaluateBestHand(cards)
    expect(hand.rank).toBe(HandRank.ROYAL_FLUSH)
  })

  it('finds best hand with two pair vs straight', () => {
    // Hole: 9♠ 8♥   Board: 7♦ 6♣ 5♠ 9♥ 2♣
    // Best: 9-8-7-6-5 straight
    const cards = [
      c('9','spades'), c('8','hearts'),
      c('7','diamonds'), c('6','clubs'), c('5','spades'), c('9','hearts'), c('2','clubs')
    ]
    const hand = evaluateBestHand(cards)
    expect(hand.rank).toBe(HandRank.STRAIGHT)
  })

  // ─── Tiebreakers ────────────────────────────────────────

  it('breaks tie on pair rank', () => {
    const aces = evaluateBestHand([c('A','spades'), c('A','hearts'), c('K','diamonds'), c('Q','clubs'), c('J','spades')])
    const kings = evaluateBestHand([c('K','spades'), c('K','hearts'), c('A','diamonds'), c('Q','clubs'), c('J','spades')])
    expect(compareHands(aces, kings)).toBeGreaterThan(0)
  })

  it('breaks tie on kicker', () => {
    const akicker = evaluateBestHand([c('J','spades'), c('J','hearts'), c('A','diamonds'), c('5','clubs'), c('2','spades')])
    const kkicker = evaluateBestHand([c('J','spades'), c('J','hearts'), c('K','diamonds'), c('5','clubs'), c('2','spades')])
    expect(compareHands(akicker, kkicker)).toBeGreaterThan(0)
  })

  it('identifies exact tie (same best hand)', () => {
    // Both have A-K-Q-J-9 high card on same community cards
    const board = [c('A','spades'), c('K','hearts'), c('Q','diamonds'), c('J','clubs'), c('9','spades')]
    const h1 = evaluateBestHand([c('2','hearts'), c('3','diamonds'), ...board])
    const h2 = evaluateBestHand([c('4','hearts'), c('5','diamonds'), ...board])
    expect(compareHands(h1, h2)).toBe(0)
  })

  it('breaks flush tiebreaker', () => {
    const bigFlush = evaluateBestHand([c('A','hearts'), c('Q','hearts'), c('10','hearts'), c('8','hearts'), c('6','hearts')])
    const smallFlush = evaluateBestHand([c('K','hearts'), c('Q','hearts'), c('10','hearts'), c('8','hearts'), c('6','hearts')])
    expect(compareHands(bigFlush, smallFlush)).toBeGreaterThan(0)
  })

  it('breaks full house tiebreaker by trio rank', () => {
    const aaa = evaluateBestHand([c('A','spades'), c('A','hearts'), c('A','diamonds'), c('K','clubs'), c('K','spades')])
    const kkk = evaluateBestHand([c('K','spades'), c('K','hearts'), c('K','diamonds'), c('A','clubs'), c('A','spades')])
    expect(compareHands(aaa, kkk)).toBeGreaterThan(0)
  })

  // ─── rankPlayers ────────────────────────────────────────

  it('ranks multiple players correctly', () => {
    const players = [
      { playerId: 'alice', cards: [c('A','spades'), c('A','hearts'), c('K','diamonds'), c('Q','clubs'), c('J','spades')] },
      { playerId: 'bob',   cards: [c('2','spades'), c('2','hearts'), c('3','diamonds'), c('4','clubs'), c('5','spades')] },
      { playerId: 'carol', cards: [c('K','spades'), c('K','hearts'), c('A','diamonds'), c('Q','clubs'), c('J','spades')] },
    ]
    const ranked = rankPlayers(players)
    expect(ranked[0][0].playerId).toBe('alice')   // Pair of aces
    expect(ranked[1][0].playerId).toBe('carol')   // Pair of kings
    expect(ranked[2][0].playerId).toBe('bob')     // Pair of twos
  })

  it('groups tied players together', () => {
    const board = [c('A','clubs'), c('K','clubs'), c('Q','clubs'), c('J','clubs'), c('10','clubs')]
    const players = [
      { playerId: 'alice', cards: [c('2','hearts'), c('3','hearts'), ...board] },
      { playerId: 'bob',   cards: [c('4','hearts'), c('5','hearts'), ...board] },
    ]
    const ranked = rankPlayers(players)
    // Both have royal flush on board — tied
    expect(ranked[0].length).toBe(2)
  })

  it('throws if fewer than 5 cards', () => {
    expect(() => evaluateBestHand([c('A','spades'), c('K','hearts'), c('Q','diamonds'), c('J','clubs')])).toThrow()
  })
})
