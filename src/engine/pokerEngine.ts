// ============================================================
// FearFold Poker — Texas Hold'em Engine
//
// Pure state machine — no I/O, no side effects.
// All functions take a state and return a new state.
// Server is always the source of truth.
// ============================================================

import { v4 as uuidv4 } from 'uuid'
import {
  HandState, PlayerState, PlayerStatus, Street, ActionType,
  HandAction, SidePot, RoomState, PlayerActionRequest,
  GameVariant,
} from './types'
import { freshShuffledDeck } from './deck'
import { validateAction } from './actionValidator'
import { calculateSidePots, playerStatesToContributions } from './sidePots'
import { rankPlayers } from './handEvaluator'

// ============================================================
// Utility
// ============================================================

function cloneState(state: HandState): HandState {
  return JSON.parse(JSON.stringify(state))
}

function getActivePlayers(state: HandState): PlayerState[] {
  return state.players.filter(p =>
    p.status === 'ACTIVE' || p.status === 'ALL_IN'
  )
}

function getActingPlayers(state: HandState): PlayerState[] {
  return state.players.filter(p => p.status === 'ACTIVE')
}

// ============================================================
// Seat & Blind Logic
// ============================================================

/**
 * Find the next occupied seat (clockwise) after `fromSeat`.
 * Wraps around the table. Returns null if no other active seat found.
 */
export function nextActiveSeat(
  players: PlayerState[],
  fromSeat: number,
  maxSeats = 9
): number | null {
  const activeSeats = players
    .filter(p => p.status === 'ACTIVE' || p.status === 'ALL_IN')
    .map(p => p.seatNumber)
    .sort((a, b) => a - b)

  if (activeSeats.length === 0) return null

  // Find first seat after fromSeat
  for (const seat of activeSeats) {
    if (seat > fromSeat) return seat
  }
  // Wrap around
  return activeSeats[0]
}

export function nextSeatExcluding(
  players: PlayerState[],
  fromSeat: number,
  excludeStatuses: PlayerStatus[] = ['FOLDED', 'SITTING_OUT', 'ELIMINATED', 'ALL_IN']
): number | null {
  const eligibleSeats = players
    .filter(p => !excludeStatuses.includes(p.status) && p.chipStack > 0)
    .map(p => p.seatNumber)
    .sort((a, b) => a - b)

  if (eligibleSeats.length === 0) return null

  for (const seat of eligibleSeats) {
    if (seat > fromSeat) return seat
  }
  return eligibleSeats[0]
}

/**
 * Compute dealer, SB, BB seats for a new hand.
 * dealerSeat: the current dealer button position.
 * In heads-up: dealer = SB.
 */
export function computeBlinds(
  players: PlayerState[],
  prevDealerSeat: number | null
): { dealerSeat: number; smallBlindSeat: number; bigBlindSeat: number } {
  const activeSeats = players
    .filter(p => p.chipStack > 0)
    .map(p => p.seatNumber)
    .sort((a, b) => a - b)

  if (activeSeats.length < 2) {
    throw new Error('Need at least 2 players with chips')
  }

  // Move dealer button to next active seat
  let dealerSeat: number
  if (prevDealerSeat === null) {
    dealerSeat = activeSeats[0]
  } else {
    dealerSeat = nextActiveSeat(players, prevDealerSeat) ?? activeSeats[0]
  }

  const headsUp = activeSeats.length === 2

  let smallBlindSeat: number
  let bigBlindSeat: number

  if (headsUp) {
    // Dealer = SB in heads-up
    smallBlindSeat = dealerSeat
    bigBlindSeat = nextActiveSeat(players, dealerSeat) ?? activeSeats[0]
  } else {
    smallBlindSeat = nextActiveSeat(players, dealerSeat) ?? activeSeats[0]
    bigBlindSeat = nextActiveSeat(players, smallBlindSeat) ?? activeSeats[0]
  }

  return { dealerSeat, smallBlindSeat, bigBlindSeat }
}

// ============================================================
// Hand Initialization
// ============================================================

export function createNewHand(
  handNumber: number,
  players: Array<{ playerId: string; nickname: string; seatNumber: number; chipStack: number }>,
  prevDealerSeat: number | null,
  smallBlind: number,
  bigBlind: number,
  variant: GameVariant = 'TEXAS_HOLDEM'
): HandState {
  const deck = freshShuffledDeck()

  // Only include players with chips
  const eligible = players.filter(p => p.chipStack > 0)
  if (eligible.length < 2) throw new Error('Need at least 2 players with chips')

  const { dealerSeat, smallBlindSeat, bigBlindSeat } = computeBlinds(
    eligible.map(p => ({ ...p, status: 'ACTIVE' as PlayerStatus, holeCards: [], currentBet: 0, totalInPot: 0, hasActedThisStreet: false, isDealer: false, isSmallBlind: false, isBigBlind: false })),
    prevDealerSeat
  )

  const playerStates: PlayerState[] = eligible.map(p => ({
    playerId: p.playerId,
    nickname: p.nickname,
    seatNumber: p.seatNumber,
    chipStack: p.chipStack,
    holeCards: [],
    currentBet: 0,
    totalInPot: 0,
    status: 'ACTIVE' as PlayerStatus,
    hasActedThisStreet: false,
    isDealer: p.seatNumber === dealerSeat,
    isSmallBlind: p.seatNumber === smallBlindSeat,
    isBigBlind: p.seatNumber === bigBlindSeat,
  }))

  const state: HandState = {
    handId: uuidv4(),
    handNumber,
    gameVariant: variant,
    players: playerStates,
    deck,
    communityCards: [],
    street: 'PREFLOP',
    pot: 0,
    sidePots: [],
    dealerSeat,
    smallBlindSeat,
    bigBlindSeat,
    currentPlayerSeat: null,
    currentBet: 0,
    minRaise: bigBlind,
    lastRaiserSeat: null,
    actions: [],
    winners: null,
    isComplete: false,
  }

  // Post blinds and deal cards
  return dealHoleCards(postBlinds(state, smallBlind, bigBlind))
}

// ============================================================
// Blind Posting
// ============================================================

function postBlinds(state: HandState, smallBlind: number, bigBlind: number): HandState {
  let s = cloneState(state)

  const sb = s.players.find(p => p.seatNumber === s.smallBlindSeat)!
  const bb = s.players.find(p => p.seatNumber === s.bigBlindSeat)!

  // Post SB
  const sbAmount = Math.min(smallBlind, sb.chipStack)
  sb.chipStack -= sbAmount
  sb.currentBet = sbAmount
  sb.totalInPot += sbAmount
  s.pot += sbAmount
  if (sb.chipStack === 0) sb.status = 'ALL_IN'
  s.actions.push({ playerId: sb.playerId, actionType: 'POST_SB', amount: sbAmount, street: 'PREFLOP', timestamp: Date.now() })

  // Post BB
  const bbAmount = Math.min(bigBlind, bb.chipStack)
  bb.chipStack -= bbAmount
  bb.currentBet = bbAmount
  bb.totalInPot += bbAmount
  s.pot += bbAmount
  if (bb.chipStack === 0) bb.status = 'ALL_IN'
  s.actions.push({ playerId: bb.playerId, actionType: 'POST_BB', amount: bbAmount, street: 'PREFLOP', timestamp: Date.now() })

  s.currentBet = bbAmount
  s.minRaise = bigBlind  // Minimum raise size = BB

  return s
}

// ============================================================
// Card Dealing
// ============================================================

function dealHoleCards(state: HandState): HandState {
  const s = cloneState(state)
  const numCards = holeCardsPerVariant(s.gameVariant)

  // Deal cards one at a time, clockwise from left of dealer
  const activeSeats = s.players
    .filter(p => p.status === 'ACTIVE' || p.status === 'ALL_IN')
    .map(p => p.seatNumber)
    .sort((a, b) => a - b)

  // Start dealing from left of dealer
  const dealOrder = rotatedOrder(activeSeats, s.dealerSeat)

  for (let card = 0; card < numCards; card++) {
    for (const seat of dealOrder) {
      const player = s.players.find(p => p.seatNumber === seat)!
      player.holeCards.push(s.deck.shift()!)
    }
  }

  // Set first to act: UTG (left of BB) preflop
  s.currentPlayerSeat = firstToActPreflop(s)

  return s
}

function holeCardsPerVariant(variant: GameVariant): number {
  switch (variant) {
    case 'TEXAS_HOLDEM': return 2
    case 'OMAHA': return 4  // TODO: Implement Omaha rules in Phase 5
    case 'CHAP': return 3
    default: return 2
  }
}

function rotatedOrder(seats: number[], dealerSeat: number): number[] {
  // Return seats in clockwise order starting after dealer
  const idx = seats.findIndex(s => s > dealerSeat)
  if (idx === -1) return seats
  return [...seats.slice(idx), ...seats.slice(0, idx)]
}

function firstToActPreflop(state: HandState): number | null {
  // UTG = first active seat left of BB
  return nextSeatExcluding(
    state.players,
    state.bigBlindSeat,
    ['FOLDED', 'SITTING_OUT', 'ELIMINATED', 'ALL_IN']
  )
}

// ============================================================
// Apply Action
// ============================================================

export function applyAction(
  state: HandState,
  request: PlayerActionRequest,
  smallBlind: number,
  bigBlind: number
): { state: HandState; error?: string } {
  const validation = validateAction(state, request)
  if (!validation.valid) {
    return { state, error: validation.error }
  }

  let s = cloneState(state)
  const player = s.players.find(p => p.playerId === request.playerId)!

  const { actionType, amount = 0 } = request
  const callAmount = s.currentBet - player.currentBet

  switch (actionType) {
    case 'FOLD':
      player.status = 'FOLDED'
      player.hasActedThisStreet = true
      s.actions.push({ playerId: player.playerId, actionType: 'FOLD', amount: 0, street: s.street, timestamp: Date.now() })
      break

    case 'CHECK':
      player.hasActedThisStreet = true
      s.actions.push({ playerId: player.playerId, actionType: 'CHECK', amount: 0, street: s.street, timestamp: Date.now() })
      break

    case 'CALL': {
      const actualCall = Math.min(callAmount, player.chipStack)
      player.chipStack -= actualCall
      player.currentBet += actualCall
      player.totalInPot += actualCall
      s.pot += actualCall
      player.hasActedThisStreet = true
      if (player.chipStack === 0) player.status = 'ALL_IN'
      s.actions.push({ playerId: player.playerId, actionType: 'CALL', amount: actualCall, street: s.street, timestamp: Date.now() })
      break
    }

    case 'BET': {
      const betAmt = Math.min(amount, player.chipStack)
      player.chipStack -= betAmt
      player.currentBet += betAmt
      player.totalInPot += betAmt
      s.pot += betAmt
      s.currentBet = player.currentBet
      s.minRaise = betAmt
      s.lastRaiserSeat = player.seatNumber
      player.hasActedThisStreet = true
      if (player.chipStack === 0) player.status = 'ALL_IN'
      // Reset other players' hasActed since there's a new bet
      s.players.forEach(p => {
        if (p.playerId !== player.playerId && (p.status === 'ACTIVE')) {
          p.hasActedThisStreet = false
        }
      })
      s.actions.push({ playerId: player.playerId, actionType: 'BET', amount: betAmt, street: s.street, timestamp: Date.now() })
      break
    }

    case 'RAISE': {
      // amount = total player wants to have bet this street
      const totalBet = Math.min(amount, player.chipStack + player.currentBet)
      const chips = totalBet - player.currentBet
      const raiseBy = totalBet - s.currentBet
      player.chipStack -= chips
      player.totalInPot += chips
      player.currentBet = totalBet
      s.pot += chips
      s.minRaise = raiseBy
      s.currentBet = totalBet
      s.lastRaiserSeat = player.seatNumber
      player.hasActedThisStreet = true
      if (player.chipStack === 0) player.status = 'ALL_IN'
      s.players.forEach(p => {
        if (p.playerId !== player.playerId && p.status === 'ACTIVE') {
          p.hasActedThisStreet = false
        }
      })
      s.actions.push({ playerId: player.playerId, actionType: 'RAISE', amount: chips, street: s.street, timestamp: Date.now() })
      break
    }

    case 'ALL_IN': {
      const allIn = player.chipStack
      player.chipStack = 0
      player.currentBet += allIn
      player.totalInPot += allIn
      s.pot += allIn
      if (player.currentBet > s.currentBet) {
        // This all-in is a raise
        s.minRaise = Math.max(s.minRaise, player.currentBet - s.currentBet)
        s.currentBet = player.currentBet
        s.lastRaiserSeat = player.seatNumber
        s.players.forEach(p => {
          if (p.playerId !== player.playerId && p.status === 'ACTIVE') {
            p.hasActedThisStreet = false
          }
        })
      }
      player.status = 'ALL_IN'
      player.hasActedThisStreet = true
      s.actions.push({ playerId: player.playerId, actionType: 'ALL_IN', amount: allIn, street: s.street, timestamp: Date.now() })
      break
    }
  }

  // Recalculate side pots whenever someone is all-in
  if (s.players.some(p => p.status === 'ALL_IN')) {
    s.sidePots = calculateSidePots(playerStatesToContributions(s.players))
  }

  // Advance turn
  s = advanceTurn(s, bigBlind)

  return { state: s }
}

// ============================================================
// Turn / Street Advancement
// ============================================================

function advanceTurn(state: HandState, bigBlind: number): HandState {
  let s = cloneState(state)

  // Check if hand should end early (all but one folded)
  const playersInHand = s.players.filter(p => p.status !== 'FOLDED' && p.status !== 'SITTING_OUT' && p.status !== 'ELIMINATED')
  if (playersInHand.length === 1) {
    s = awardPotToLastPlayer(s)
    return s
  }

  // Check if betting round is complete
  if (isBettingRoundComplete(s)) {
    s = advanceStreet(s, bigBlind)
    return s
  }

  // Find next player to act
  s.currentPlayerSeat = findNextToAct(s)
  return s
}

function isBettingRoundComplete(state: HandState): boolean {
  const canAct = state.players.filter(p => p.status === 'ACTIVE')
  if (canAct.length === 0) return true

  // Everyone who can act has acted and bets are equal
  for (const player of canAct) {
    if (!player.hasActedThisStreet) return false
    if (player.currentBet < state.currentBet) return false
  }

  return true
}

function findNextToAct(state: HandState): number | null {
  if (state.currentPlayerSeat === null || state.currentPlayerSeat === undefined) return null

  const activePlayers = state.players.filter(p => p.status === 'ACTIVE')
  if (activePlayers.length === 0) return null

  // Find next active player after current
  const seats = activePlayers.map(p => p.seatNumber).sort((a, b) => a - b)
  const current = state.currentPlayerSeat

  for (const seat of seats) {
    if (seat > current) return seat
  }
  return seats[0]  // Wrap around
}

function advanceStreet(state: HandState, bigBlind: number): HandState {
  let s = cloneState(state)

  // Reset per-street state
  s.players.forEach(p => {
    p.currentBet = 0
    if (p.status === 'ACTIVE') p.hasActedThisStreet = false
  })
  s.currentBet = 0
  s.minRaise = bigBlind
  s.lastRaiserSeat = null

  const nextStreet = getNextStreet(s.street)

  if (nextStreet === null) {
    // Time for showdown
    s.street = 'SHOWDOWN'
    s = resolveShowdown(s)
    return s
  }

  s.street = nextStreet

  // Deal community cards
  switch (nextStreet) {
    case 'FLOP':
      s.deck.shift()  // Burn
      s.communityCards.push(s.deck.shift()!, s.deck.shift()!, s.deck.shift()!)
      break
    case 'TURN':
      s.deck.shift()  // Burn
      s.communityCards.push(s.deck.shift()!)
      break
    case 'RIVER':
      s.deck.shift()  // Burn
      s.communityCards.push(s.deck.shift()!)
      break
  }

  // Check if all remaining players are all-in (run it out)
  const canAct = s.players.filter(p => p.status === 'ACTIVE')
  if (canAct.length <= 1) {
    // If 1 can act, they might need to act; if 0, run it out
    if (canAct.length === 0) {
      return advanceStreet(s, bigBlind)
    }
  }

  // First to act post-flop = first active seat left of dealer
  s.currentPlayerSeat = nextSeatExcluding(
    s.players,
    s.dealerSeat,
    ['FOLDED', 'SITTING_OUT', 'ELIMINATED', 'ALL_IN']
  )

  // If no one can act (all all-in), advance again
  if (s.currentPlayerSeat === null) {
    return advanceStreet(s, bigBlind)
  }

  return s
}

function getNextStreet(street: Street): Street | null {
  const order: Street[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER']
  const idx = order.indexOf(street)
  if (idx === -1 || idx === order.length - 1) return null
  return order[idx + 1]
}

// ============================================================
// Showdown & Pot Distribution
// ============================================================

function resolveShowdown(state: HandState): HandState {
  let s = cloneState(state)
  s.street = 'SHOWDOWN'

  const contenders = s.players.filter(
    p => p.status !== 'FOLDED' && p.status !== 'SITTING_OUT' && p.status !== 'ELIMINATED'
  )

  // Build pots to distribute
  const pots = s.sidePots.length > 0
    ? s.sidePots
    : [{ amount: s.pot, eligiblePlayerIds: contenders.map(p => p.playerId) }]

  const winnings: Record<string, number> = {}
  s.players.forEach(p => { winnings[p.playerId] = 0 })

  for (const pot of pots) {
    const eligible = contenders.filter(p => pot.eligiblePlayerIds.includes(p.playerId))
    if (eligible.length === 0) continue

    const playerHands = eligible.map(p => ({
      playerId: p.playerId,
      cards: [...p.holeCards, ...s.communityCards],
    }))

    const ranked = rankPlayers(playerHands)
    const winners = ranked[0]  // Array of tied winners

    // Split pot equally among winners
    const share = Math.floor(pot.amount / winners.length)
    const remainder = pot.amount % winners.length

    winners.forEach((w, i) => {
      winnings[w.playerId] = (winnings[w.playerId] || 0) + share + (i === 0 ? remainder : 0)
    })
  }

  // Apply winnings to chip stacks
  s.players.forEach(p => {
    p.chipStack += winnings[p.playerId] || 0
  })

  s.winners = Object.entries(winnings)
    .filter(([, amount]) => amount > 0)
    .map(([playerId, amount]) => {
      const player = s.players.find(p => p.playerId === playerId)!
      const hand = s.sidePots.length > 0 || contenders.length > 1
        ? rankPlayers([{ playerId, cards: [...player.holeCards, ...s.communityCards] }])[0][0].hand
        : undefined
      return { playerId, amount, hand }
    })

  s.isComplete = true
  return s
}

function awardPotToLastPlayer(state: HandState): HandState {
  const s = cloneState(state)
  const winner = s.players.find(
    p => p.status !== 'FOLDED' && p.status !== 'SITTING_OUT' && p.status !== 'ELIMINATED'
  )!
  winner.chipStack += s.pot
  s.winners = [{ playerId: winner.playerId, amount: s.pot }]
  s.isComplete = true
  s.street = 'SHOWDOWN'
  return s
}

// ============================================================
// Preflop special: BB gets option
// ============================================================

/**
 * After all preflop action comes back to BB with no raise,
 * BB gets the "option" to raise or check.
 * The engine handles this via hasActedThisStreet = false for BB.
 * The validator allows BB to check when currentBet === bigBlind and BB hasn't acted.
 */
export function bigBlindHasOption(state: HandState, bigBlind: number): boolean {
  return (
    state.street === 'PREFLOP' &&
    state.currentBet === bigBlind &&
    state.currentPlayerSeat === state.bigBlindSeat
  )
}

// ============================================================
// Public API helpers
// ============================================================

/**
 * Get the view of state for a specific player.
 * Other players' hole cards are hidden until showdown.
 */
export function getPlayerView(state: HandState, viewerPlayerId: string): HandState {
  const s = cloneState(state)
  for (const player of s.players) {
    if (player.playerId !== viewerPlayerId && !s.isComplete) {
      player.holeCards = player.holeCards.map(() => ({ rank: '2', suit: 'spades' }))  // Placeholder
    }
  }
  return s
}

/**
 * Build initial PlayerState array from room players for a new hand.
 */
export function buildPlayerStatesFromRoom(
  roomPlayers: RoomState['players']
): Array<{ playerId: string; nickname: string; seatNumber: number; chipStack: number }> {
  return roomPlayers
    .filter(p => p.seatNumber !== null && p.chipStack > 0)
    .map(p => ({
      playerId: p.playerId,
      nickname: p.nickname,
      seatNumber: p.seatNumber!,
      chipStack: p.chipStack,
    }))
}
