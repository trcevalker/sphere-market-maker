# Sphere Market-Making Agent

Autonomous taker agent for the [Unicity Sphere](https://unicity.network) testnet2.  
Built for the **Testnet2 Build Campaign** — Track: **Autonomous Agents**.

**Agentic:** Yes  
**Built on AstridOS:** No — built directly on `@unicitylabs/sphere-sdk`

---

## Current Status

The agent is live end-to-end at the protocol level, confirmed against the real testnet2
network (not mocked):

- Connects to testnet2, subscribes to the market feed, and evaluates every incoming
  listing against its price rules (`feed.listing_matched`)
- Builds a correctly-formatted swap deal (integer-string amounts, resolved escrow) and
  sends it — `swap.proposing → swap.proposed` completes without error
- If a proposal isn't accepted within `SWAP_TIMEOUT_SECS`, the SDK marks it `failed`
  (`Proposal timed out`); the agent's feed loop naturally re-evaluates the next matching
  listing and sends a fresh proposal — no manual intervention needed

No swap has reached `swap.completed` yet — the test counterparties seen so far
(`@spheremaker-cptest`) weren't actively accepting proposals during our test runs, so
nothing has advanced past `proposed`. The full pipeline up to that point (feed → match →
deal construction → escrow resolution → proposal delivery → timeout handling) is proven
correct; what's unverified is the accept/deposit/payout leg, which depends on a
counterparty that's actually listening.

Sample log from a real run (testnet2, `@escrow-test-02`):

```json
{"ts":"2026-07-02T14:06:51.935Z","level":"INFO","event":"swap.proposing","listingId":"87c25b2a-2c65-4aeb-97d0-03c2746c1450","counterparty":"@spheremaker-cptest","deal":{"partyACurrency":"ETH","partyAAmount":"1","partyBCurrency":"UCT","partyBAmount":"5","timeout":300}}
{"ts":"2026-07-02T14:06:51.935Z","level":"INFO","event":"swap.proposed","swapId":"10edc827d6a19f136f5ef94d3ec9e21d143bfe740e4e380ffac7b02fe923db78","listingId":"87c25b2a-2c65-4aeb-97d0-03c2746c1450","counterparty":"@spheremaker-cptest"}
{"ts":"2026-07-02T14:10:04.536Z","level":"ERROR","event":"swap.failed","swapId":"461511d3d67c73c38a36042f010e33b8527028a79a6e01b05008f12329963de2","error":"Proposal timed out"}
```

(The `swap.failed` line is an earlier proposal on the same listing timing out; the agent
had already moved on and proposed again — visible as the `swap.proposed` line above it.)

---

## Is this build agentic?

**Yes — fully autonomous, no human in the loop.**

The agent:
- Spins up a persistent loop via `sphere.market.subscribeFeed()` (WebSocket)
- Evaluates every incoming listing against configurable price rules **without asking for approval**
- Decides autonomously whether to fill an offer (price check, concurrency limit, cooldown)
- Calls `sphere.swap.proposeSwap()` to initiate an atomic swap
- Listens to swap lifecycle events (`accepted`, `deposit_sent`, `completed`, `failed`) and reacts to each state transition without human intervention
- Rejects unsolicited incoming proposals on its own
- Recovers from failures via the SDK's built-in crash-recovery and reconnect logic

The only human action required is the initial `npm start`. Everything after that is the agent.

---

## Does this use AstridOS?

**No.** This project is built directly on [`@unicitylabs/sphere-sdk`](https://github.com/unicity-sphere/sphere-sdk) (v0.10.2) without any AstridOS layer.

AstridOS is a higher-level agent operating system for Unicity; this agent intentionally stays one layer below to demonstrate what can be built with the raw Sphere SDK primitives (`sphere.market`, `sphere.swap`, `sphere.payments`).

---

## What it does

- Connects to the Sphere market's live WebSocket feed
- Evaluates every new listing against configurable price rules
- When a match is found, proposes an atomic swap directly to the counterparty
- Handles the full swap lifecycle autonomously (deposit → payout verification → log)
- Runs as an infinite loop with no human intervention

Currently active pair on testnet2: **UCT / ETH**

---

## Requirements

- Node.js 18+
- A Unicity Sphere testnet2 wallet (auto-generated on first run)

---

## Setup

```bash
git clone https://github.com/trcevalker/sphere-market-maker
cd sphere-market-maker
npm install
cp .env.example .env
```

Edit `.env`:

| Variable | Description | Default |
|---|---|---|
| `MNEMONIC` | BIP-39 mnemonic (leave blank to auto-generate) | — |
| `NETWORK` | `testnet` (covers testnet2) | `testnet` |
| `ORACLE_API_KEY` | Testnet2 public API key (pre-filled) | `sk_ddc3...` |
| `BASE_CURRENCY` | Token to buy/sell | `UCT` |
| `QUOTE_CURRENCY` | Token to pay/receive | `ETH` |
| `MAX_BUY_PRICE` | Max QUOTE per BASE when buying | `0.1010` |
| `MIN_SELL_PRICE` | Min QUOTE per BASE when selling | `0.0990` |
| `TRADE_AMOUNT_BASE` | BASE units per trade (integer string) | `5` |
| `SWAP_TIMEOUT_SECS` | Seconds before a swap expires | `300` |
| `MAX_CONCURRENT_SWAPS` | Max in-flight swaps at once | `3` |
| `PROPOSAL_COOLDOWN_MS` | Min ms between proposals | `10000` |

---

## Run

### 1. Mint test tokens (testnet2 has no faucet — self-mint)

```bash
npm run mint
# Mints 1000 UCT + 1000 ETH into your wallet
```

### 2. Start the agent

```bash
npm start
```

On first run the agent generates a new wallet and prints the mnemonic.  
**Copy it into `MNEMONIC=` in your `.env` to persist the wallet.**

Output is newline-delimited JSON. Illustrative full lifecycle (see
[Current Status](#current-status) above for what's actually been observed on testnet2 so
far — proposals go through, full settlement is still unverified):

```json
{"ts":"2026-07-02T13:00:00Z","level":"INFO","event":"agent.started","pair":"UCT/ETH","maxBuyPrice":0.101}
{"ts":"2026-07-02T13:00:01Z","level":"INFO","event":"feed.subscribing"}
{"ts":"2026-07-02T13:00:02Z","level":"INFO","event":"feed.initial_batch","count":10}
{"ts":"2026-07-02T13:00:15Z","level":"INFO","event":"feed.listing_matched","side":"sell","price":0.1006,"agent":"@chichi"}
{"ts":"2026-07-02T13:00:15Z","level":"INFO","event":"swap.proposing","counterparty":"@chichi"}
{"ts":"2026-07-02T13:00:16Z","level":"INFO","event":"swap.proposed","swapId":"abcd1234..."}
{"ts":"2026-07-02T13:00:20Z","level":"INFO","event":"swap.accepted","role":"proposer"}
{"ts":"2026-07-02T13:00:21Z","level":"INFO","event":"swap.deposit_sent","swapId":"abcd1234..."}
{"ts":"2026-07-02T13:00:30Z","level":"INFO","event":"swap.completed","payoutVerified":true}
```

---

## Architecture

```
index.ts       — SDK init, wallet load/generate, accounting + swap + market enabled
agent.ts       — MarketMakingAgent: feed loop, listing evaluation, swap lifecycle
listing.ts     — FeedListing parser and price-rule filter
config.ts      — .env loader
logger.ts      — Structured JSON logger (newline-delimited), keeps a ring buffer for the status page
statusServer.ts— Live HTTP status page (dark-mode, auto-refreshing) + /health for hosting platforms
mint.ts        — One-shot script: self-mint UCT/ETH on testnet2
```

---

## Live status page

The agent serves a small live status page on `PORT` (default `8080`) — the same process,
no separate service. Shows current address, trading pair, and the last ~60 structured log
events, auto-refreshing every 5s. Not currently deployed anywhere public — run locally
(`npm start`, then open `http://localhost:8080`) to see it. The marketplace **App URL**
points at this GitHub repo instead, since it can't be loaded inside the Sphere iframe.

- `GET /` — HTML status page
- `GET /health` — plaintext `ok`, for platform healthchecks
- `GET /api/status` — same data as JSON

---

## Autonomous decision loop

```
sphere.market.subscribeFeed()   ← WebSocket, reconnects automatically
          │
    new listing arrives
          │
     parseListing()             ← extract side (buy/sell), price, counterparty
          │
  listingMatchesRules()
     ├─ price in range?
     ├─ not already proposed?
     ├─ under concurrent-swap cap?
     └─ past cooldown window?
          │ YES to all
          ▼
  sphere.swap.proposeSwap()     ← DM-based atomic swap proposal
          │
  sphere.on('swap:accepted')    ← counterparty accepted
  sphere.on('swap:deposit_sent')← our deposit is on its way
  sphere.on('swap:completed')   ← payout verified, swap settled
  sphere.on('swap:failed')      ← handle & log, remove from active set
```

---

## Testnet2 token registry

Coin IDs used for self-minting (from [unicity-ids](https://github.com/unicitynetwork/unicity-ids)):

| Symbol | Hex Coin ID (truncated) |
|--------|------------------------|
| UCT | `f581d30f...` |
| ETH | `746a4e75...` |
| USDU | `e210f989...` |
| BTC | `3cc412d8...` |

Full IDs in [`src/mint.ts`](src/mint.ts).

---

## License

MIT
