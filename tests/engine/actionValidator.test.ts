// ============================================================
// Tests: Action Validator
// ============================================================

import { describe, it, expect } from 'vitest'
import { validateAction, getLegalActions } from '../../src/engine/actionValidator'
import { createNewHand, applyAction } from '../../src/engine/pokerEngine'
import { HandState } from '../../src/engine/types'

const SB = 1
const BB = 2

function makePlayers(count: number, chipStack = 100) {
  return Array.from({ length: count }, (_, i) => ({
    playerId: `p${i}`,
    nickname: `P${i}`,
    seatNumber: i,
    chipStack,
  }))
}

describe('Action Validator', () => {
  it('rejects action on completed hand', () => {
    const hand = createNewHand(1, makePlayers(2), null, SB, BB)
    // Make hand complete
    const hand2 = { ...hand, isComplete: true }
    const actingPlayer = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)!
    const result = validateAction(hand2, {
      playerId: actingPlayer.playerId,
      handId: hand.handId,
      actionType: 'FOLD',
    })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/complete/i)
  })

  it('rejects action from non-existent player', () => {
    const hand = createNewHand(1, makePlayers(2), null, SB, BB)
    const result = validateAction(hand, {
      playerId: 'ghost',
      handId: hand.handId,
      actionType: 'FOLD',
    })
    expect(result.valid).toBe(false)
  })

  it('rejects action out of turn', () => {
    const hand = createNewHand(1, makePlayers(3), null, SB, BB)
    const wrongPlayer = hand.players.find(p => p.seatNumber !== hand.currentPlayerSeat)!
    const result = validateAction(hand, {
      playerId: wrongPlayer.playerId,
      handId: hand.handId,
      actionType: 'FOLD',
    })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/turn/i)
  })

  it('allows fold on any turn', () => {
    const hand = createNewHand(1, makePlayers(3), null, SB, BB)
    const actor = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)!
    const result = validateAction(hand, {
      playerId: actor.playerId,
      handId: hand.handId,
      actionType: 'FOLD',
    })
    expect(result.valid).toBe(true)
  })

  it('rejects check when there is an outstanding bet', () => {
    const hand = createNewHand(1, makePlayers(3), null, SB, BB)
    const actor = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)!
    // There is a BB outstanding
    expect(hand.currentBet).toBeGreaterThan(0)
    const result = validateAction(hand, {
      playerId: actor.playerId,
      handId: hand.handId,
      actionType: 'CHECK',
    })
    expect(result.valid).toBe(false)
  })

  it('rejects raise below minimum', () => {
    const hand = createNewHand(1, makePlayers(3), null, SB, BB)
    const actor = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)!
    // Min raise = BB (2), so raise must be to at least 4 (2 + 2)
    const result = validateAction(hand, {
      playerId: actor.playerId,
      handId: hand.handId,
      actionType: 'RAISE',
      amount: 3,  // Raising to 3 — only 1 above BB, less than minRaise of 2
    })
    // Raise by = 3 - 0 (currentBet of this player) = 3 chips in
    // raiseAmount = 3 - 2 (call) = 1, which is < minRaise(2)
    expect(result.valid).toBe(false)
  })

  it('rejects bet when current bet exists', () => {
    const hand = createNewHand(1, makePlayers(3), null, SB, BB)
    const actor = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)!
    const result = validateAction(hand, {
      playerId: actor.playerId,
      handId: hand.handId,
      actionType: 'BET',
      amount: 10,
    })
    // There's already a BB — should raise, not bet
    expect(result.valid).toBe(false)
  })

  it('returns correct legal actions when facing bet', () => {
    const hand = createNewHand(1, makePlayers(3), null, SB, BB)
    const actorId = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)!.playerId
    const actions = getLegalActions(hand, actorId)
    const actionTypes = actions.map(a => a.action)
    expect(actionTypes).toContain('FOLD')
    expect(actionTypes).toContain('CALL')
    expect(actionTypes).toContain('RAISE')
    expect(actionTypes).not.toContain('CHECK')
    expect(actionTypes).not.toContain('BET')
  })

  it('returns check and bet when no bet exists', () => {
    // Get to flop where SB acts first with no bet
    const players = makePlayers(2, 100)
    let hand = createNewHand(1, players, null, SB, BB)

    // Advance to flop using cheapest actions each turn
    let safety = 0
    while (hand.street === 'PREFLOP' && !hand.isComplete && safety < 10) {
      safety++
      const actingSeat = hand.currentPlayerSeat
      if (actingSeat === null) break
      const actor = hand.players.find(p => p.seatNumber === actingSeat)
      if (!actor) break
      const callAmt = hand.currentBet - actor.currentBet
      const actionType = callAmt === 0 ? 'CHECK' : 'CALL'
      const result = applyAction(hand, { playerId: actor.playerId, handId: hand.handId, actionType }, SB, BB)
      if (result.error) break
      hand = result.state
    }

    if (hand.street === 'FLOP' && hand.currentPlayerSeat !== null) {
      const actorId = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)!.playerId
      const actions = getLegalActions(hand, actorId)
      const actionTypes = actions.map(a => a.action)
      expect(actionTypes).toContain('CHECK')
      expect(actionTypes).toContain('BET')
      expect(actionTypes).not.toContain('RAISE')
    }
  })

  it('rejects all-in when player has no chips', () => {
    const hand = createNewHand(1, makePlayers(3), null, SB, BB)
    const actor = hand.players.find(p => p.seatNumber === hand.currentPlayerSeat)!
    // Manually set chipStack to 0
    const modHand = {
      ...hand,
      players: hand.players.map(p =>
        p.playerId === actor.playerId ? { ...p, chipStack: 0 } : p
      ),
    }
    const result = validateAction(modHand as HandState, {
      playerId: actor.playerId,
      handId: hand.handId,
      actionType: 'ALL_IN',
    })
    expect(result.valid).toBe(false)
  })
})
