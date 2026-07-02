# Sphere Market-Making Agent

Autonomous taker agent for the [Unicity Sphere](https://unicity.network) testnet2.  
Built for the **Testnet2 Build Campaign** — Track: **Autonomous Agents**.

## What it does

- Connects to the Sphere market's live WebSocket feed  
- Evaluates every new listing against configurable price rules  
- When a match is found, proposes an atomic swap directly to the counterparty  
- Handles the full swap lifecycle autonomously (deposit, payout verification, logging)  
- Runs as an infinite loop with no human intervention

Currently active pair on testnet2: **UCT / ETH**

## Requirements

- Node.js 18+
- A Unicity Sphere testnet2 wallet (auto-generated on first run)

## Setup

```bash
git clone https://github.com/<your-handle>/sphere-market-maker
cd sphere-market-maker
npm install
cp .env.example .env
```

Edit `.env`:

| Variable | Description | Default |
|---|---|---|
| `MNEMONIC` | BIP-39 mnemonic (leave blank to auto-generate) | — |
| `NETWORK` | `testnet` (covers testnet2) | `testnet` |
| `BASE_CURRENCY` | Token to buy/sell | `UCT` |
| `QUOTE_CURRENCY` | Token to pay/receive | `ETH` |
| `MAX_BUY_PRICE` | Max QUOTE per BASE when buying | `0.1010` |
| `MIN_SELL_PRICE` | Min QUOTE per BASE when selling | `0.0990` |
| `TRADE_AMOUNT_BASE` | BASE units per trade (integer string) | `5` |
| `SWAP_TIMEOUT_SECS` | Seconds before a swap expires | `300` |
| `MAX_CONCURRENT_SWAPS` | Max in-flight swaps at once | `3` |
| `PROPOSAL_COOLDOWN_MS` | Min ms between proposals | `10000` |

## Run

```bash
npm start
```

On first run the agent generates a new wallet and prints the mnemonic.  
**Copy it into `MNEMONIC=` in your `.env` to persist the wallet.**

Output is newline-delimited JSON (one event per line), e.g.:

```json
{"ts":"2026-07-02T13:00:00.000Z","level":"INFO","event":"agent.started","pair":"UCT/ETH"}
{"ts":"2026-07-02T13:00:01.000Z","level":"INFO","event":"feed.subscribing"}
{"ts":"2026-07-02T13:00:02.000Z","level":"INFO","event":"feed.listing_matched","side":"sell","price":0.1006}
{"ts":"2026-07-02T13:00:02.000Z","level":"INFO","event":"swap.proposed","swapId":"abcd..."}
{"ts":"2026-07-02T13:00:10.000Z","level":"INFO","event":"swap.completed","payoutVerified":true}
```

## Architecture

```
index.ts          — SDK init, wallet load/generate
agent.ts          — MarketMakingAgent: feed loop + swap lifecycle
listing.ts        — FeedListing parser and price-rule filter
config.ts         — .env loader
logger.ts         — Structured JSON logger
```

## How the taker loop works

```
subscribeFeed()
     │
     ▼
 new listing
     │
  parseListing()   ← extract side, price, amounts
     │
  listingMatchesRules()
     │  price in range?
     │  not already proposed?
     │  under concurrent-swap limit?
     │  past cooldown?
     ▼
  proposeSwap()    ← send atomic-swap proposal via DM
     │
  swap events      ← accepted / deposit_sent / completed / failed
     ▼
  log each step
```

## License

MIT
