// ============================================================
// FearFold Poker — Action Validator
//
// All player actions pass through here before being applied.
// The server never trusts the client — every action is validated.
// ============================================================

import { HandState, PlayerActionRequest, ActionType, PlayerState } from './types'

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateAction(
  state: HandState,
  request: PlayerActionRequest
): ValidationResult {
  const { playerId, actionType, amount = 0 } = request

  // Hand must be active
  if (state.isComplete) {
    return { valid: false, error: 'Hand is complete' }
  }

  // Must be a valid street (not showdown)
  if (state.street === 'SHOWDOWN') {
    return { valid: false, error: 'Cannot act during showdown' }
  }

  // Find the acting player
  const player = state.players.find(p => p.playerId === playerId)
  if (!player) {
    return { valid: false, error: 'Player not found in this hand' }
  }

  // Must be their turn
  const currentPlayer = state.players.find(p => p.seatNumber === state.currentPlayerSeat)
  if (!currentPlayer || currentPlayer.playerId !== playerId) {
    return { valid: false, error: `Not your turn. Current: seat ${state.currentPlayerSeat}` }
  }

  // Player must be in an actionable state
  if (player.status === 'FOLDED') {
    return { valid: false, error: 'You have already folded' }
  }
  if (player.status === 'ALL_IN') {
    return { valid: false, error: 'You are all-in and cannot act' }
  }
  if (player.status === 'SITTING_OUT' || player.status === 'ELIMINATED') {
    return { valid: false, error: 'You are not in this hand' }
  }

  const callAmount = state.currentBet - player.currentBet
  const playerStack = player.chipStack

  switch (actionType) {
    case 'FOLD':
      // Always valid if it's your turn
      return { valid: true }

    case 'CHECK':
      // Valid only if current bet equals player's current bet (nothing to call)
      if (callAmount > 0) {
        return { valid: false, error: `Cannot check — must call ${callAmount} or fold` }
      }
      return { valid: true }

    case 'CALL': {
      // Valid if there's something to call
      if (callAmount <= 0) {
        return { valid: false, error: 'Nothing to call — check instead' }
      }
      // Even if player can't fully call (short stack), they go all-in
      // This is handled as a partial call / all-in scenario
      return { valid: true }
    }

    case 'BET': {
      // Valid only when there's no current bet (first aggressor this street)
      if (state.currentBet > 0) {
        return { valid: false, error: 'There is already a bet — raise instead' }
      }
      if (amount <= 0) {
        return { valid: false, error: 'Bet amount must be positive' }
      }
      // Minimum bet = big blind
      // (state doesn't carry BB directly but minRaise is set to BB pre-action)
      if (amount < state.minRaise && amount < playerStack) {
        return { valid: false, error: `Minimum bet is ${state.minRaise}` }
      }
      if (amount > playerStack) {
        return { valid: false, error: `You only have ${playerStack} chips` }
      }
      return { valid: true }
    }

    case 'RAISE': {
      if (state.currentBet === 0) {
        return { valid: false, error: 'No bet to raise — bet instead' }
      }
      // Minimum raise: the raise must be at least as large as the previous raise/bet
      // total raise amount = amount the player adds on top of the call
      const totalRaise = amount  // amount = total placed by player this street after this action
      const raiseBy = totalRaise - player.currentBet  // net chips going in
      const callCost = state.currentBet - player.currentBet
      const raiseAmount = raiseBy - callCost

      if (raiseAmount < state.minRaise && raiseBy < playerStack) {
        return {
          valid: false,
          error: `Minimum raise is ${state.minRaise}. Your raise must be at least ${state.currentBet + state.minRaise}`,
        }
      }
      if (raiseBy > playerStack) {
        return { valid: false, error: `You only have ${playerStack} chips` }
      }
      return { valid: true }
    }

    case 'ALL_IN':
      // Always valid if player has chips
      if (playerStack <= 0) {
        return { valid: false, error: 'You have no chips' }
      }
      return { valid: true }

    case 'POST_SB':
    case 'POST_BB':
      // Internal actions — not triggered by player
      return { valid: true }

    default:
      return { valid: false, error: `Unknown action type: ${actionType}` }
  }
}

/**
 * Returns the legal actions a player can take right now.
 * Used to drive UI button states.
 */
export function getLegalActions(
  state: HandState,
  playerId: string
): { action: ActionType; minAmount?: number; maxAmount?: number }[] {
  const player = state.players.find(p => p.playerId === playerId)
  if (!player || player.status !== 'ACTIVE') return []

  const currentSeat = state.currentPlayerSeat
  if (player.seatNumber !== currentSeat) return []

  const callAmount = state.currentBet - player.currentBet
  const actions: { action: ActionType; minAmount?: number; maxAmount?: number }[] = []

  // Fold always available
  actions.push({ action: 'FOLD' })

  if (callAmount === 0) {
    // Check available
    actions.push({ action: 'CHECK' })
    // Bet available
    actions.push({
      action: 'BET',
      minAmount: state.minRaise,
      maxAmount: player.chipStack,
    })
  } else {
    // Call available
    const actualCall = Math.min(callAmount, player.chipStack)
    actions.push({ action: 'CALL', minAmount: actualCall, maxAmount: actualCall })

    // Raise available if player has enough chips
    const minRaiseTotal = state.currentBet + state.minRaise
    if (player.chipStack > callAmount) {
      actions.push({
        action: 'RAISE',
        minAmount: minRaiseTotal,
        maxAmount: player.chipStack + player.currentBet,
      })
    }
  }

  // All-in always available if player has chips
  if (player.chipStack > 0) {
    actions.push({ action: 'ALL_IN', minAmount: player.chipStack, maxAmount: player.chipStack })
  }

  return actions
}
