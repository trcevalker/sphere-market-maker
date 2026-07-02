import 'dotenv/config';

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

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

  swapTimeoutSecs: parseInt(optional('SWAP_TIMEOUT_SECS', '300'), 10),
  maxConcurrentSwaps: parseInt(optional('MAX_CONCURRENT_SWAPS', '3'), 10),
  proposalCooldownMs: parseInt(optional('PROPOSAL_COOLDOWN_MS', '10000'), 10),
} as const;
