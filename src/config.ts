import 'dotenv/config';

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  mnemonic: process.env.MNEMONIC || undefined,
  network: optional('NETWORK', 'testnet') as 'testnet' | 'mainnet' | 'dev',
  dataDir: optional('DATA_DIR', './wallet-data'),

  baseCurrency: optional('BASE_CURRENCY', 'UCT'),
  quoteCurrency: optional('QUOTE_CURRENCY', 'ETH'),

  maxBuyPrice: parseFloat(optional('MAX_BUY_PRICE', '0.1010')),
  minSellPrice: parseFloat(optional('MIN_SELL_PRICE', '0.0990')),

  // Integer string — smallest denomination understood by Sphere SDK
  tradeAmountBase: optional('TRADE_AMOUNT_BASE', '5'),

  // Escrow service nametag for testnet2 swaps. The SDK docs reference
  // '@escrow-testnet', which does not currently resolve on-network; confirmed
  // live via sphere.resolve() that '@escrow-test-02' does, matching the
  // default the reference counterparty bot (@spheremaker-cptest, aka the
  // "SphereMaker" reference agent) uses for its own proposals.
  escrowAddress: optional('ESCROW_ADDRESS', '@escrow-test-02'),

  swapTimeoutSecs: parseInt(optional('SWAP_TIMEOUT_SECS', '300'), 10),
  maxConcurrentSwaps: parseInt(optional('MAX_CONCURRENT_SWAPS', '3'), 10),
  proposalCooldownMs: parseInt(optional('PROPOSAL_COOLDOWN_MS', '10000'), 10),
  oracleApiKey: optional('ORACLE_API_KEY', 'sk_ddc3cfcc001e4a28ac3fad7407f99590'),
} as const;
