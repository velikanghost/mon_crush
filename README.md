# Mon Match - Farcaster Mini App

A fun match-three style farcaster mini app, built on Monad blockchain, and powered by Scaffold-ETH 2.

![Mon Match Game](https://mon-crush-nextjs-five.vercel.app/thumbnail.jpg)

## 🔍 Technology Stack

Mon Match is built using powerful, modern web3 technologies:

- **Scaffold-ETH 2**: The foundation framework that connects the frontend to blockchain
- **Farcaster**: Social integration for user authentication and social features
- **Foundry**: Smart contract development and testing framework
- **Neynar**: API integration for Farcaster social features and notifications

Additional technologies:

- **Blockchain**: Monad Testnet
- **Frontend**: Next.js 15, React, TailwindCSS, DaisyUI
- **Web3 Integration**: wagmi, viem
- **Game Logic**: Custom match-three engine built in React
- **Notifications**: Farcaster Frames and push notifications

## 🎯 How to Play

### Solo Mode

- Match 3 or more of the same Monanimal by swapping adjacent tiles
- Create matches to earn points and increase your score
- Try to maximize your score within the time limit
- Scores are recorded on the Monad blockchain

### Versus Mode

- Challenge a friend by sending them a game invitation
- Each player wagers MON tokens on the outcome
- Both players play the same board in parallel for a set time
- The highest score wins the wager
- Results are automatically processed on-chain

## 🎲 Game Features

- **Solo Mode**: Play at your own pace and compete for high scores
- **Versus Mode**: Challenge friends to matches with crypto wagers
- **Farcaster Integration**: Connect with your Farcaster account
- **Blockchain Scoring**: All scores and game results stored on-chain
- **Game Wallet**: Dedicated game wallet for smooth gameplay transactions
- **Notifications**: Get notified when someone challenges you or when games end

## 🛠️ Smart Contracts

The game uses several smart contracts:

- **MonadMatch.sol**: Main game contract for solo mode
- **GameEscrow.sol**: Handles wagers and payouts for versus mode

## 📄 License

This project is licensed under the MIT License.

---

Built with ❤️ using [Scaffold-ETH 2](https://github.com/scaffold-eth/scaffold-eth-2)
