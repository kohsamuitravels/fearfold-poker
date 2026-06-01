// ============================================================
// FearFold Poker — Chap House Rule
//
// "Chap" is a custom home-game rule where all players agree
// to cancel/skip the current hand by paying a penalty.
//
// Rules:
// 1. Each participating player pays 25 chips penalty.
// 2. Each player receives 3 hole cards.
// 3. A flop (3 community cards) is dealt.
// 4. TODO: Define exact winner determination rules for Chap.
//
// This is architected as a pluggable variant, separate from
// the core Texas Hold'em engine.
// ============================================================

import { v4 as uuidv4 } from 'uuid'
import { Card, ChapState, HandState, PlayerState, PlayerStatus, RoomState } from '../types'
import { freshShuffledDeck } from '../deck'
import { calculateSidePots, playerStatesToContributions } from '../sidePots'
import { rankPlayers } from '../handEvaluator'

export const CHAP_PENALTY = 25
export const CHAP_HOLE_CARDS = 3

/**
 * Start a Chap hand. All players with enough chips participate.
 * Returns the initial HandState for a Chap round.
 */
export function createChapHand(
  handNumber: number,
  players: Array<{ playerId: string; nickname: string; seatNumber: number; chipStack: number }>,
  dealerSeat: number
): HandState {
  const eligible = players.filter(p => p.chipStack >= CHAP_PENALTY)
  if (eligible.length < 2) throw new Error('Need at least 2 players with enough chips for Chap')

  const deck = freshShuffledDeck()

  const playerStates: PlayerState[] = eligible.map(p => ({
    playerId: p.playerId,
    nickname: p.nickname,
    seatNumber: p.seatNumber,
    chipStack: p.chipStack - CHAP_PENALTY,  // Deduct penalty upfront
    holeCards: [],
    currentBet: CHAP_PENALTY,
    totalInPot: CHAP_PENALTY,
    status: 'ACTIVE' as PlayerStatus,
    hasActedThisStreet: true,  // No betting in Chap
    isDealer: p.seatNumber === dealerSeat,
    isSmallBlind: false,
    isBigBlind: false,
  }))

  const pot = eligible.length * CHAP_PENALTY

  // Deal 3 hole cards to each player
  const seatsInOrder = eligible.map(p => p.seatNumber).sort((a, b) => a - b)
  for (let card = 0; card < CHAP_HOLE_CARDS; card++) {
    for (const seat of seatsInOrder) {
      const player = playerStates.find(p => p.seatNumber === seat)!
      player.holeCards.push(deck.shift()!)
    }
  }

  // Deal flop
  deck.shift()  // Burn card
  const communityCards: Card[] = [deck.shift()!, deck.shift()!, deck.shift()!]

  const state: HandState = {
    handId: uuidv4(),
    handNumber,
    gameVariant: 'CHAP',
    players: playerStates,
    deck,
    communityCards,
    street: 'FLOP',  // Chap only has a flop for now
    pot,
    sidePots: calculateSidePots(playerStatesToContributions(playerStates)),
    dealerSeat,
    smallBlindSeat: dealerSeat,  // N/A for Chap
    bigBlindSeat: dealerSeat,    // N/A for Chap
    currentPlayerSeat: null,     // No player action needed
    currentBet: 0,
    minRaise: 0,
    lastRaiserSeat: null,
    actions: eligible.map(p => ({
      playerId: p.playerId,
      actionType: 'POST_SB',  // Reuse as "pay Chap tax"
      amount: CHAP_PENALTY,
      street: 'PREFLOP',
      timestamp: Date.now(),
    })),
    winners: null,
    isComplete: false,
  }

  // TODO: Determine Chap winner rules
  // Options to implement later:
  // - Best 5-card hand using 2 of 3 hole cards + 3 community cards?
  // - Best 5-card hand using any combination?
  // - Special Chap-specific hand rankings?
  // - Voting/agreement mechanic?
  // For now, use standard best-5-of-6 evaluation:
  return resolveChapShowdown(state)
}

/**
 * TODO: Replace this with proper Chap winner rules once defined.
 * Currently uses standard poker hand evaluation (best 5 of 6 cards).
 */
function resolveChapShowdown(state: HandState): HandState {
  const s = { ...state }

  // TODO: Implement proper Chap winner determination
  // Current: uses standard best 5 of (3 hole + 3 community)
  const playerHands = s.players.map(p => ({
    playerId: p.playerId,
    cards: [...p.holeCards, ...s.communityCards],
  }))

  const ranked = rankPlayers(playerHands)
  const winners = ranked[0]

  const share = Math.floor(s.pot / winners.length)
  const remainder = s.pot % winners.length

  s.players = s.players.map(p => {
    const winnerIdx = winners.findIndex(w => w.playerId === p.playerId)
    if (winnerIdx !== -1) {
      return {
        ...p,
        chipStack: p.chipStack + share + (winnerIdx === 0 ? remainder : 0),
      }
    }
    return p
  })

  s.winners = winners.map((w, i) => ({
    playerId: w.playerId,
    amount: share + (i === 0 ? remainder : 0),
    hand: w.hand,
  }))

  s.isComplete = true
  s.street = 'SHOWDOWN'

  return s
}

export function getChapEventMessage(nickname: string): string {
  return `${nickname} paid the Chap tax 🃏`
}
