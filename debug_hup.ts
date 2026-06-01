import { createNewHand, applyAction } from './src/engine/pokerEngine'

const players = [
  {playerId:'p0',nickname:'P0',seatNumber:0,chipStack:100},
  {playerId:'p1',nickname:'P1',seatNumber:1,chipStack:100}
]
let hand = createNewHand(1, players, null, 1, 2)
console.log('dealer:', hand.dealerSeat, 'sb:', hand.smallBlindSeat, 'bb:', hand.bigBlindSeat, 'currentSeat:', hand.currentPlayerSeat)
console.log('players:', hand.players.map(p => ({seat: p.seatNumber, bet: p.currentBet, hasActed: p.hasActedThisStreet, status: p.status})))
console.log('currentBet:', hand.currentBet)

let safety = 0
while (hand.street === 'PREFLOP' && !hand.isComplete && safety < 10) {
  safety++
  const actingSeat = hand.currentPlayerSeat
  if (actingSeat === null) { console.log('no acting seat'); break }
  const actor = hand.players.find(p => p.seatNumber === actingSeat)
  if (!actor) { console.log('no actor'); break }
  const callAmt = hand.currentBet - actor.currentBet
  const actionType: any = callAmt === 0 ? 'CHECK' : 'CALL'
  console.log(`Turn ${safety}: seat ${actingSeat} (${actor.playerId}) ${actionType} (callAmt=${callAmt}, currentBet=${hand.currentBet}, playerBet=${actor.currentBet})`)
  const result = applyAction(hand, { playerId: actor.playerId, handId: hand.handId, actionType }, 1, 2)
  if (result.error) { console.log('error:', result.error); break }
  hand = result.state
  console.log('  -> street:', hand.street, 'nextSeat:', hand.currentPlayerSeat, 'players:', hand.players.map(p => ({seat:p.seatNumber, hasActed:p.hasActedThisStreet, status:p.status, bet:p.currentBet})))
}
console.log('final street:', hand.street)
