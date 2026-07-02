/**
 * One-shot token minting script for testnet2.
 *
 * Usage:
 *   npm run mint
 *   UCT_AMOUNT=500 ETH_AMOUNT=500 npm run mint
 *
 * Testnet2 has no faucet — you self-mint via the v2 token engine.
 * Run this once before starting the agent so it has a balance to trade with.
 *
 * Coin IDs from:
 *   https://raw.githubusercontent.com/unicitynetwork/unicity-ids/refs/heads/main/unicity-ids.testnet2.json
 */

import { Sphere } from '@unicitylabs/sphere-sdk';
import { createNodeProviders } from '@unicitylabs/sphere-sdk/impl/nodejs';
import { config } from './config.js';

// Testnet2 hex coin IDs (64-char lowercase hex)
const COIN_IDS: Record<string, string> = {
  UCT:  'f581d30f593e4b369d684a4563b5246f07b1d265f7178a2c0a82b81f39c24dc0',
  ETH:  '746a4e75aeb3221462f762fc41925735983c6039e89288bbb632a8fb1012e7d0',
  USDU: 'e210f98956f564bfe67ee94fddd386b5157f660d1957169b391f962093a2da2a',
  BTC:  '3cc412d8a24510d424f74de4c471d22298b7f52625af6fd3ecb3c3d9e1a683fb',
  SOL:  '72f7771d5690afcf89cfc16e8ee8c1a836d0faa8ed1b34d527aabc18acb949ae',
  USDT: 'bd7ad59dc3d86cf9a42d8027d2733a3999126d1bc0adb922fe6f031f073ccce0',
  USDC: '6684ca2f90cd0b0aa8eaf0af2513c75cf2c6d30fc705089b2424bacf74fc3aa1',
};

const UCT_AMOUNT = BigInt(process.env['UCT_AMOUNT']  ?? '1000');
const ETH_AMOUNT = BigInt(process.env['ETH_AMOUNT']  ?? '1000');

async function mint(): Promise<void> {
  console.log('Initializing wallet...');

  const providers = createNodeProviders({
    network: config.network,
    dataDir: config.dataDir,
    oracle: { apiKey: config.oracleApiKey },
  });

  const { sphere } = await Sphere.init({
    ...providers,
    network: config.network,
    ...(config.mnemonic ? { mnemonic: config.mnemonic } : { autoGenerate: true }),
    accounting: true,
  });

  const address = sphere.identity?.directAddress ?? sphere.identity?.nametag ?? 'unknown';
  console.log(`Wallet: ${address}`);

  const payments = (sphere as any).payments;
  if (!payments?.mintFungibleToken) {
    console.error('ERROR: Payments/accounting module not available.');
    process.exit(1);
  }

  await mintOne(payments, 'UCT', UCT_AMOUNT);
  await mintOne(payments, 'ETH', ETH_AMOUNT);

  console.log('\nDone. Run npm start to launch the trading agent.');
  process.exit(0);
}

async function mintOne(payments: any, symbol: string, amount: bigint): Promise<void> {
  const coinId = COIN_IDS[symbol];
  if (!coinId) {
    console.error(`Unknown symbol: ${symbol}`);
    return;
  }
  console.log(`\nMinting ${amount} ${symbol} (coinId: ${coinId.slice(0, 12)}...)...`);
  const result = await payments.mintFungibleToken(coinId, amount);
  if (result.success) {
    console.log(`  OK — tokenId: ${result.tokenId}`);
  } else {
    console.error(`  FAILED: ${result.error}`);
  }
}

mint().catch((err: unknown) => {
  console.error('Mint script failed:', String(err));
  process.exit(1);
});
