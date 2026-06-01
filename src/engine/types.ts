// ============================================================
// FearFold Poker — Core Engine Types
// ============================================================

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'J' | 'Q' | 'K' | 'A'

export interface Card {
  rank: Rank
  suit: Suit
}

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
}

// Hand categories (higher = better)
export enum HandRank {
  HIGH_CARD       = 1,
  ONE_PAIR        = 2,
  TWO_PAIR        = 3,
  THREE_OF_A_KIND = 4,
  STRAIGHT        = 5,
  FLUSH           = 6,
  FULL_HOUSE      = 7,
  FOUR_OF_A_KIND  = 8,
  STRAIGHT_FLUSH  = 9,
  ROYAL_FLUSH     = 10,
}

export const HAND_RANK_NAMES: Record<HandRank, string> = {
  [HandRank.HIGH_CARD]:       'High Card',
  [HandRank.ONE_PAIR]:        'One Pair',
  [HandRank.TWO_PAIR]:        'Two Pair',
  [HandRank.THREE_OF_A_KIND]: 'Three of a Kind',
  [HandRank.STRAIGHT]:        'Straight',
  [HandRank.FLUSH]:           'Flush',
  [HandRank.FULL_HOUSE]:      'Full House',
  [HandRank.FOUR_OF_A_KIND]:  'Four of a Kind',
  [HandRank.STRAIGHT_FLUSH]:  'Straight Flush',
  [HandRank.ROYAL_FLUSH]:     'Royal Flush',
}

export interface EvaluatedHand {
  rank: HandRank
  name: string
  // Tiebreaker values: primary rank, then kickers, all descending
  tiebreakers: number[]
  bestFive: Card[]
}

// ============================================================
// Game State Types
// ============================================================

export type GameVariant = 'TEXAS_HOLDEM' | 'OMAHA' | 'CHAP'
export type Street = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN'
export type PlayerStatus =
  | 'ACTIVE'      // Can act
  | 'FOLDED'      // Folded this hand
  | 'ALL_IN'      // All in, can't act
  | 'SITTING_OUT' // Not in this hand
  | 'ELIMINATED'  // No chips and declined rebuy

export type ActionType =
  | 'FOLD'
  | 'CHECK'
  | 'CALL'
  | 'BET'
  | 'RAISE'
  | 'ALL_IN'
  | 'POST_SB'
  | 'POST_BB'

export interface PlayerState {
  playerId: string
  nickname: string
  seatNumber: number
  chipStack: number
  holeCards: Card[]
  currentBet: number   // Amount bet in CURRENT street
  totalInPot: number   // Total contributed to pot in this hand
  status: PlayerStatus
  hasActedThisStreet: boolean
  isDealer: boolean
  isSmallBlind: boolean
  isBigBlind: boolean
}

export interface SidePot {
  amount: number
  eligiblePlayerIds: string[]
}

export interface HandAction {
  playerId: string
  actionType: ActionType
  amount: number
  street: Street
  timestamp: number
}

export interface HandState {
  handId: string
  handNumber: number
  gameVariant: GameVariant
  
  // Players in this hand (may be subset of room players)
  players: PlayerState[]
  
  deck: Card[]
  communityCards: Card[]
  
  street: Street
  
  pot: number
  sidePots: SidePot[]
  
  dealerSeat: number
  smallBlindSeat: number
  bigBlindSeat: number
  
  currentPlayerSeat: number | null  // Whose turn
  
  // Betting round tracking
  currentBet: number      // Highest bet on table this street
  minRaise: number        // Minimum raise amount
  lastRaiserSeat: number | null
  
  actions: HandAction[]
  
  // Result
  winners: Array<{
    playerId: string
    amount: number
    hand?: EvaluatedHand
  }> | null
  
  isComplete: boolean
}

export interface RoomConfig {
  smallBlind: number
  bigBlind: number
  startingStack: number
  maxPlayers: number
  gameVariant: GameVariant
  houseRulesEnabled: boolean
}

export interface RoomState {
  roomId: string
  config: RoomConfig
  players: Array<{
    playerId: string
    nickname: string
    seatNumber: number | null
    chipStack: number
    totalBought: number
    isHost: boolean
    isConnected: boolean
  }>
  status: 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'ENDED'
  currentHand: HandState | null
  handNumber: number
  dealerSeat: number | null
  eventLog: Array<{ message: string; timestamp: number; emoji?: string }>
}

// ============================================================
// Action Request / Response
// ============================================================

export interface PlayerActionRequest {
  playerId: string
  handId: string
  actionType: ActionType
  amount?: number
}

export interface ActionResult {
  valid: boolean
  error?: string
  newState?: HandState
}

// ============================================================
// Chap House Rule types
// ============================================================

export interface ChapState {
  participatingPlayerIds: string[]
  // Each player pays 25 chips penalty
  penaltyPaid: boolean
  // Each player receives 3 hole cards
  holeCardsDealt: boolean
  // Community: flop (3 cards) only
  flopDealt: boolean
  // TODO: Define exact winner determination rules for Chap
  // TODO: Currently ends at flop — add multi-street support if desired
}
