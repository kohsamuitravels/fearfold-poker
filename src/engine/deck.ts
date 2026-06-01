// ============================================================
// FearFold Poker — Deck
// Builds a standard 52-card deck and shuffles it using
// Fisher-Yates with crypto randomness.
// ============================================================

import { Card, Rank, Suit } from './types'
import { randomBytes } from 'crypto'

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']

export function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

/**
 * Fisher-Yates shuffle using crypto.randomBytes for unbiased randomness.
 * Returns a new shuffled deck without mutating the input.
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const arr = [...deck]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = cryptoRandInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Returns a cryptographically random integer in [0, max).
 */
function cryptoRandInt(max: number): number {
  if (max <= 1) return 0
  // Find smallest byte count sufficient to represent max
  const bytesNeeded = Math.ceil(Math.log2(max + 1) / 8) || 1
  const maxRange = Math.pow(256, bytesNeeded)
  const remainder = maxRange % max
  let rand: number

  // Rejection sampling to eliminate bias
  do {
    const bytes = randomBytes(bytesNeeded)
    rand = 0
    for (let i = 0; i < bytesNeeded; i++) {
      rand = rand * 256 + bytes[i]
    }
  } while (rand >= maxRange - remainder)

  return rand % max
}

export function cardToString(card: Card): string {
  const suitSymbol = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }
  return `${card.rank}${suitSymbol[card.suit]}`
}

export function stringToCard(s: string): Card {
  // Format: "A♠", "10♥", "K♦", "2♣"
  const suitMap: Record<string, Suit> = {
    '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs'
  }
  const suit = suitMap[s[s.length - 1]]
  const rank = s.slice(0, -1) as Rank
  if (!suit || !rank) throw new Error(`Invalid card string: ${s}`)
  return { rank, suit }
}

export function freshShuffledDeck(): Card[] {
  return shuffleDeck(buildDeck())
}
