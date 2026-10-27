# 👻 Hemi's Graveyard

A free-to-play, first-person ghost shooter that runs in your browser — with your winning score recorded **onchain on Hemi Mainnet**.

Year 3026. The dead of Hemi still refuse to rest. Open the five graves, survive Rick and his horde, beat the boss **Rickoala**, and claim the Golden Ticket.

> Built for **Hemi Arcade 2.0**.

## ▶️ Play

**Live:** _add your Vercel URL here_

1. Open the link on a desktop/laptop (keyboard + mouse).
2. Connect **MetaMask** or **Rabby** — the game adds/switches to **Hemi Mainnet** automatically.
3. Enter your name and play.
4. Win → press **Submit score onchain** and confirm the transaction.

**Free to play.** The game never asks for payment. Submitting a score sends a `0 ETH` transaction, so you only pay the tiny Hemi network gas fee (you need a little ETH on Hemi for gas).

No wallet? Add `?practice` to the URL to play without a wallet (no transaction, no submit).

## 🎮 Controls

| Key | Action |
|---|---|
| `W A S D` | Move |
| Mouse | Look / shoot |
| `R` | Reload |
| `Esc` | Pause |

## ⛓️ Onchain integration

| | |
|---|---|
| Network | **Hemi Mainnet** (chain ID `43111`) |
| RPC | `https://rpc.hemi.network/rpc` |
| Explorer | https://explorer.hemi.xyz |
| Score contract | [`0xadDb40da2AF99F0494E8BE0Bb0B6c8ECA6d79d0D`](https://explorer.hemi.xyz/address/0xadDb40da2AF99F0494E8BE0Bb0B6c8ECA6d79d0D) |

- Wallets: MetaMask and Rabby (EIP-6963 discovery + legacy `window.ethereum`).
- When you press **Enter the Graveyard**, the game calls `startGame(string name)` on the contract with `value = 0` (emits a `GameStarted` event). The game only begins after that transaction is confirmed successful on-chain. You pay only network gas. Skipped in `?practice` mode; can be disabled with `REQUIRE_START_TX` in `js/chain.js`.
- On win, the game calls `submitScore(string name, uint32 score, uint16 graves, uint16 kills, uint32 time)` on the contract above, with `value = 0`.
- Before any transaction the game verifies the wallet is on chain ID `43111` and simulates the call (`eth_estimateGas`) so reverts are caught before the wallet popup.
- All chain code lives in [`js/chain.js`](js/chain.js) (a tiny built-in keccak/ABI encoder — no external web3 library). The contract address and function signature are at the top of that file.
- Contract source: [`contracts/HemiGraveyardScores.sol`](contracts/HemiGraveyardScores.sol).

## 🛠️ Run locally

```bash
git clone https://github.com/<your-username>/hemi-graveyard.git
cd hemi-graveyard
npm start        # serves http://localhost:8000
```

Wallets don't work on pages opened as `file://` — use the local server (or VS Code Live Server).

## 🚀 Deployed on vercel


## 🧱 Tech

- Vanilla JavaScript + [Three.js](https://threejs.org/) (bundled in `lib/`)
- Web Audio + pre-rendered voice clips for the boss (`audio/voice/`)
- Solidity (score contract), Hemi Mainnet

## 🔊 Voices

- **Rick** and the ghosts: whisper texture + browser speech synthesis.
- **Rickoala** (boss): 3 pre-rendered clips in `audio/voice/boss_*.mp3`, mapped by exact text in `js/voices.js`.

## 📜 License

[MIT](LICENSE) © 2026 Uttam 
