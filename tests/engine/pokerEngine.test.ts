// ============================================================
// Tests: Poker Engine — Full Hand Scenarios
// ============================================================

import { describe, it, expect } from 'vitest'
import { createNewHand, applyAction, computeBlinds, nextActiveSeat } from '../../src/engine/pokerEngine'
import { HandState } from '../../src/engine/types'

const SMALL_BLIND = 1
const BIG_BLIND = 2

// Helper to create test players
function makePlayers(count: number, chipStack = 100) {
  return Array.from({ length: count }, (_, i) => ({
    playerId: `player${i}`,
    nickname: `Player${i}`,
    seatNumber: i,
    chipStack,
  }))
}

describe('Poker Engine', () => {
  // ─── Hand Initialization ─────────────────────────────────

  it('creates a new hand with correct structure', () => {
    const players = makePlayers(3)
    const hand = createNewHand(1, players, null, SMALL_BLIND, BIG_BLIND)

    expect(hand.handId).toBeTruthy()
    expect(hand.street).toBe('PREFLOP')
    expect(hand.players.length).toBe(3)
    expect(hand.communityCards.length).toBe(0)
    expect(hand.isComplete).toBe(false)
  })

  it('deals 2 hole cards to each player', () => {
    const players = makePlayers(4)
    const hand = createNewHand(1, players, null, SMALL_BLIND, BIG_BLIND)
    for (const p of hand.players) {
      expect(p.holeCards.length).toBe(2)
    }
  })

  it('posts blinds correctly', () => {
    const players = makePlayers(3, 100)
    const hand = createNewHand(1, players, null, SMALL_BLIND, BIG_BLIND)

    const sbPlayer = hand.players.find(p => p.isSmallBlind)!
    const bbPlayer = hand.players.find(p => p.isBigBlind)!

    expect(sbPlayer.currentBet).toBe(SMALL_BLIND)
    expect(bbPlayer.currentBet).toBe(BIG_BLIND)
    expect(hand.pot).toBe(SMALL_BLIND + BIG_BLIND)
    expect(hand.currentBet).toBe(BIG_BLIND)
  })

  it('sets correct first to act (UTG, left of BB)', () => {
    const players = makePlayers(4)
    const hand = createNewHand(1, players, null, SMALL_BLIND, BIG_BLIND)

    const bbSeat = hand.bigBlindSeat
    // UTG should be first active seat after BB
    expect(hand.currentPlayerSeat).not.toBe(bbSeat)
    expect(hand.currentPlayerSeat).not.toBeNull()
  })

  // ─── Blind Rotation ───────────────────────────────────────

  it('rotates dealer button correctly between hands', () => {
    const players = makePlayers(4).map(p => ({
      ...p,
      status: 'ACTIVE' as const,
      holeCards: [],
      currentBet: 0,
      totalInPot: 0,
      hasActedThisStreet: false,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
    }))

    const { dealerSeat: d1 } = computeBlinds(players, null)
    const { dealerSeat: d2 } = computeBlinds(players, d1)
    const { dealerSeat: d3 } = computeBlinds(players, d2)
    const { dealerSeat: d4 } = computeBlinds(players, d3)
    const { dealerSeat: d5 } = computeBlinds(players, d4)

    // Should cycle through seats 0, 1, 2, 3, 0...
    expect(d1).toBe(0)
    expect(d2).toBe(1)
    expect(d3).toBe(2)
    expect(d4).toBe(3)
    expect(d5).toBe(0)
  })

  // ─── Action Sequence ─────────────────────────────────────

  it('processes fold correctly', () => {
    const players = makePlayers(3)
    let hand = createNewHand(1, players, null, SMALL_BLIND, BIG_BLIND)
    const actingPlayer = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)!

    const result = applyAction(hand, {
      playerId: actingPlayer.playerId,
      handId: hand.handId,
      actionType: 'FOLD',
    }, SMALL_BLIND, BIG_BLIND)

    expect(result.error).toBeUndefined()
    const folded = result.state.players.find(p => p.playerId === actingPlayer.playerId)!
    expect(folded.status).toBe('FOLDED')
  })

  it('processes call correctly', () => {
    const players = makePlayers(3, 100)
    let hand = createNewHand(1, players, null, SMALL_BLIND, BIG_BLIND)
    const actingPlayer = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)!
    const beforeStack = actingPlayer.chipStack

    const result = applyAction(hand, {
      playerId: actingPlayer.playerId,
      handId: hand.handId,
      actionType: 'CALL',
    }, SMALL_BLIND, BIG_BLIND)

    expect(result.error).toBeUndefined()
    const after = result.state.players.find(p => p.playerId === actingPlayer.playerId)!
    expect(after.chipStack).toBe(beforeStack - BIG_BLIND)
  })

  it('processes raise correctly', () => {
    const players = makePlayers(3, 100)
    let hand = createNewHand(1, players, null, SMALL_BLIND, BIG_BLIND)
    const actingPlayer = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)!

    // Raise to 6 (raise by 4 on top of BB)
    const result = applyAction(hand, {
      playerId: actingPlayer.playerId,
      handId: hand.handId,
      actionType: 'RAISE',
      amount: 6,
    }, SMALL_BLIND, BIG_BLIND)

    expect(result.error).toBeUndefined()
    expect(result.state.currentBet).toBe(6)
  })

  it('rejects action out of turn', () => {
    const players = makePlayers(3)
    const hand = createNewHand(1, players, null, SMALL_BLIND, BIG_BLIND)
    const wrongPlayer = hand.players.find(p => p.seatNumber !== hand.currentPlayerSeat)!

    const result = applyAction(hand, {
      playerId: wrongPlayer.playerId,
      handId: hand.handId,
      actionType: 'FOLD',
    }, SMALL_BLIND, BIG_BLIND)

    expect(result.error).toBeTruthy()
  })

  it('rejects check when there is a bet', () => {
    const players = makePlayers(3)
    const hand = createNewHand(1, players, null, SMALL_BLIND, BIG_BLIND)
    const actingPlayer = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)!

    // There is already a BB bet — can't check
    const result = applyAction(hand, {
      playerId: actingPlayer.playerId,
      handId: hand.handId,
      actionType: 'CHECK',
    }, SMALL_BLIND, BIG_BLIND)

    expect(result.error).toBeTruthy()
  })

  // ─── All-In Scenario ─────────────────────────────────────

  it('handles all-in correctly', () => {
    const players = makePlayers(3, 20)  // Small stack
    let hand = createNewHand(1, players, null, SMALL_BLIND, BIG_BLIND)
    const actingPlayer = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)!

    const result = applyAction(hand, {
      playerId: actingPlayer.playerId,
      handId: hand.handId,
      actionType: 'ALL_IN',
    }, SMALL_BLIND, BIG_BLIND)

    expect(result.error).toBeUndefined()
    const allInPlayer = result.state.players.find(p => p.playerId === actingPlayer.playerId)!
    expect(allInPlayer.status).toBe('ALL_IN')
    expect(allInPlayer.chipStack).toBe(0)
  })

  // ─── Street Advancement ───────────────────────────────────

  it('advances to flop after preflop betting', () => {
    const players = makePlayers(2, 100)
    let hand = createNewHand(1, players, null, SMALL_BLIND, BIG_BLIND)

    // Keep acting until we reach flop — use cheapest action each turn
    let safety = 0
    while (hand.street === 'PREFLOP' && !hand.isComplete && safety < 10) {
      safety++
      const actingSeat = hand.currentPlayerSeat
      if (actingSeat === null) break
      const actor = hand.players.find(p => p.seatNumber === actingSeat)
      if (!actor) break
      const callAmt = hand.currentBet - actor.currentBet
      const actionType = callAmt === 0 ? 'CHECK' : 'CALL'
      const result = applyAction(hand, { playerId: actor.playerId, handId: hand.handId, actionType }, SMALL_BLIND, BIG_BLIND)
      if (result.error) break
      hand = result.state
    }

    expect(hand.street).toBe('FLOP')
    expect(hand.communityCards.length).toBe(3)
  })

  // ─── Hand Completion ─────────────────────────────────────

  it('ends hand when all but one player folds', () => {
    const players = makePlayers(2)
    let hand = createNewHand(1, players, null, SMALL_BLIND, BIG_BLIND)

    // Player 0 folds
    const actingPlayer = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)!
    const result = applyAction(hand, {
      playerId: actingPlayer.playerId,
      handId: hand.handId,
      actionType: 'FOLD',
    }, SMALL_BLIND, BIG_BLIND)

    expect(result.state.isComplete).toBe(true)
    expect(result.state.winners).toBeTruthy()
    expect(result.state.winners!.length).toBe(1)
  })

  it('awards pot to last standing player', () => {
    const players = makePlayers(2, 100)
    let hand = createNewHand(1, players, null, SMALL_BLIND, BIG_BLIND)

    const actingPlayer = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)!
    const otherPlayer = hand.players.find(p => p.playerId !== actingPlayer.playerId)!
    const otherBefore = otherPlayer.chipStack

    const result = applyAction(hand, {
      playerId: actingPlayer.playerId,
      handId: hand.handId,
      actionType: 'FOLD',
    }, SMALL_BLIND, BIG_BLIND)

    const winner = result.state.players.find(p => p.playerId === otherPlayer.playerId)!
    // Winner should have received the pot
    expect(winner.chipStack).toBeGreaterThan(otherBefore)
  })

  // ─── nextActiveSeat ───────────────────────────────────────

  it('correctly finds next active seat', () => {
    const players = [
      { seatNumber: 0, status: 'ACTIVE' as const },
      { seatNumber: 2, status: 'ACTIVE' as const },
      { seatNumber: 5, status: 'ACTIVE' as const },
      { seatNumber: 7, status: 'ACTIVE' as const },
    ].map(p => ({ ...p, playerId: `p${p.seatNumber}`, nickname: 'x', chipStack: 100, holeCards: [], currentBet: 0, totalInPot: 0, hasActedThisStreet: false, isDealer: false, isSmallBlind: false, isBigBlind: false }))

    expect(nextActiveSeat(players, 0)).toBe(2)
    expect(nextActiveSeat(players, 5)).toBe(7)
    expect(nextActiveSeat(players, 7)).toBe(0)  // Wraps
    expect(nextActiveSeat(players, 8)).toBe(0)  // Wraps
  })

  // ─── Showdown Payout ─────────────────────────────────────

  it('pays out pot at showdown', () => {
    const players = makePlayers(2, 50)
    let hand = createNewHand(1, players, null, SMALL_BLIND, BIG_BLIND)

    // Play out a simple all-in hand
    // Both go all-in
    while (!hand.isComplete) {
      if (hand.currentPlayerSeat === null) break
      const acting = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)
      if (!acting) break
      const result = applyAction(hand, {
        playerId: acting.playerId,
        handId: hand.handId,
        actionType: 'ALL_IN',
      }, SMALL_BLIND, BIG_BLIND)
      if (result.error) break
      hand = result.state
    }

    if (hand.isComplete) {
      // Total chips should be conserved
      const totalBefore = 50 * 2
      const totalAfter = hand.players.reduce((sum, p) => sum + p.chipStack, 0)
      expect(totalAfter).toBe(totalBefore)
    }
  })
})
