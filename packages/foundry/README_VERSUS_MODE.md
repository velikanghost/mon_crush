# Versus Mode Implementation Guide

This guide explains how to implement and use the versus mode feature for the Monad Match game.

## Overview

The versus mode allows two players to compete against each other in a timed match, with an optional wager system where players can bet MON tokens on the outcome. The player with the highest score at the end of the time limit wins the match and claims the prize.

## Installation

Follow these steps to implement the versus mode:

1. Add the GameEscrow contract:

   ```bash
   # Copy the GameEscrow.sol file to the contracts directory
   cp GameEscrow.sol packages/foundry/contracts/
   ```

2. Add the VersusMode component:

   ```bash
   # Copy the VersusMode.tsx file to the components directory
   cp VersusMode.tsx packages/nextjs/components/home/
   ```

3. Update the GameBoardStep component:

   ```bash
   # Update the existing GameBoardStep.tsx file
   # This adds the tab interface for switching between solo and versus modes
   ```

4. Deploy the contracts:

   ```bash
   # Deploy contracts to the Monad testnet
   cd packages/foundry
   forge script script/DeployContracts.s.sol --rpc-url <your-rpc-url> --private-key <your-private-key> --broadcast
   ```

5. Update contract addresses in deployedContracts.ts after deployment.

## Technical Architecture

```
┌────────────────────────┐      ┌────────────────────────┐
│                        │      │                        │
│     Player 1 (P1)      │      │     Player 2 (P2)      │
│                        │      │                        │
└───────────┬────────────┘      └────────────┬───────────┘
            │                                │
            │                                │
            ▼                                ▼
┌────────────────────────────────────────────────────────┐
│                                                        │
│                  Frontend UI (NextJS)                  │
│                                                        │
│  ┌────────────────┐        ┌─────────────────────┐    │
│  │                │        │                     │    │
│  │  Game Board    │        │   Versus Mode UI    │    │
│  │                │        │                     │    │
│  └────────────────┘        └─────────────────────┘    │
│                                                        │
└───────────────────────────┬────────────────────────────┘
                            │
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                                                        │
│                 Smart Contracts (Solidity)             │
│                                                        │
│  ┌────────────────┐        ┌─────────────────────┐    │
│  │                │        │                     │    │
│  │  MonadMatch    │◄──────►│    GameEscrow       │    │
│  │                │        │                     │    │
│  └────────────────┘        └─────────────────────┘    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## Sequence Diagram

```
┌─────┐          ┌─────┐          ┌────────────┐          ┌──────────────┐
│ P1  │          │ P2  │          │ GameEscrow │          │ MonadMatch   │
└──┬──┘          └──┬──┘          └─────┬──────┘          └──────┬───────┘
   │                │                    │                        │
   │ Create Game    │                    │                        │
   │─────────────────────────────────────>                        │
   │                │                    │                        │
   │                │                    │ Store Game & P1 Wager  │
   │                │                    │────────────────────────│
   │                │                    │                        │
   │                │ Invite to Game     │                        │
   │                │<───────────────────│                        │
   │                │                    │                        │
   │                │ Join Game          │                        │
   │                │────────────────────>                        │
   │                │                    │                        │
   │                │                    │ Start Game & Timer     │
   │                │                    │─────────────────────┐  │
   │                │                    │                     │  │
   │                │                    │<────────────────────┘  │
   │                │                    │                        │
   │ Record Match   │                    │                        │
   │────────────────────────────────────────────────────────────>│
   │                │                    │                        │
   │                │ Record Match       │                        │
   │                │───────────────────────────────────────────>│
   │                │                    │                        │
   │                │                    │                        │
   │ Timer Expires  │                    │                        │
   │─────────────────────────────────────>                        │
   │                │                    │                        │
   │                │                    │ Get P1 Score           │
   │                │                    │───────────────────────>│
   │                │                    │                        │
   │                │                    │ Get P2 Score           │
   │                │                    │───────────────────────>│
   │                │                    │                        │
   │                │                    │ Determine Winner       │
   │                │                    │─────────────────────┐  │
   │                │                    │                     │  │
   │                │                    │<────────────────────┘  │
   │                │                    │                        │
   │                │                    │ Transfer Prize         │
   │                │                    │─────────────────────┐  │
   │                │                    │                     │  │
   │                │                    │<────────────────────┘  │
   │                │                    │                        │
┌──┴──┐          ┌──┴──┐          ┌─────┴──────┐          ┌──────┴───────┐
│ P1  │          │ P2  │          │ GameEscrow │          │ MonadMatch   │
└─────┘          └─────┘          └────────────┘          └──────────────┘
```

## Components

1. **GameEscrow Contract**: Manages the wager system and game invitations
2. **VersusMode UI Component**: Frontend interface for creating/accepting challenges and viewing game status
3. **Modified GameBoardStep**: Integration of the versus mode into the main game UI

## Data Flow

1. **Game Creation**:

   - P1 creates a game → GameEscrow.createGame() → Escrow holds P1's wager
   - P2 receives notification of game invitation

2. **Game Acceptance**:

   - P2 accepts game → GameEscrow.joinGame() → Escrow holds P2's wager
   - Game timer starts automatically

3. **Game Play**:

   - Both players make matches → MonadMatch.recordMatch() → Scores update on-chain
   - UI shows countdown timer from GameEscrow

4. **Game Completion**:
   - Timer expires → GameEscrow.endGame() → Contract checks scores
   - Winner determined → Funds transferred → Game marked as complete

## Smart Contract Deployment

1. First, deploy the GameEscrow contract:

```bash
# From the project root
cd packages/foundry
forge script script/DeployContracts.s.sol --rpc-url <your-rpc-url> --private-key <your-private-key> --broadcast
```

2. After deployment, note the contract addresses in the deployment logs and update them in the `packages/nextjs/contracts/deployedContracts.ts` file:

```typescript
// Add GameEscrow contract
GameEscrow: {
  address: "YOUR_DEPLOYED_CONTRACT_ADDRESS", // Replace with actual address
  abi: [
    // ABI will be generated automatically from deployment
  ],
  inheritedFunctions: {},
},
```

## Using the Versus Mode

Once deployed, users can:

1. **Create a Challenge**:

   - Enter the Farcaster username of an opponent
   - Specify a wager amount (in MON)
   - Send the challenge

2. **Accept a Challenge**:

   - View incoming challenge invitations
   - Match the specified wager amount
   - Accept the challenge, which automatically starts the game

3. **Play the Game**:

   - Both players try to make as many matches as possible within the time limit
   - The timer counts down from 2 minutes
   - The game board is the same for both players

4. **Claim the Prize**:
   - When the timer expires, the player with the highest score wins
   - The GameEscrow contract automatically distributes the prize to the winner
   - In case of a tie, both players' wagers are returned

## Contract Functions

### GameEscrow Contract

- `createGame(string player2FarcasterName, string player1FarcasterName)` - Creates a new game invitation
- `joinGame(bytes32 gameId, string farcasterName)` - Accept a game invitation
- `endGame(bytes32 gameId)` - End a game and distribute prizes
- `cancelGame(bytes32 gameId)` - Cancel a pending game
- `getPlayerActiveGames(address player)` - Get all active games for a player
- `getGameDetails(bytes32 gameId)` - Get details of a specific game
- `gameNeedsEnding(bytes32 gameId)` - Check if a game needs to be ended

## Technical Details

### Game ID Generation

Game IDs are generated using `keccak256(abi.encodePacked(player1Address, player2FarcasterName, block.timestamp))` to ensure uniqueness.

### Wager System

The wager system works by escrowing funds from both players in the contract until the game ends. The winner receives the combined wager amount.

### Auto-Disbursement

When a game's time limit is reached, the `endGame` function can be called to:

1. Compare the scores of both players from the MonadMatch contract
2. Determine the winner
3. Transfer the prize to the winner's address
4. In case of a tie, return the wagers to both players

## Security Considerations

- Funds are held in escrow until the game concludes
- The contract uses checks to prevent multiple claims or unauthorized cancellations
- Game states are used to track the progress of each game
- Farcaster names are associated with wallet addresses to prevent impersonation

## Development Notes

For local testing, you can modify the `GAME_DURATION` constant in the contract to a shorter time period to facilitate testing.

```solidity
// For local testing
uint256 public constant GAME_DURATION = 30 seconds;
```
