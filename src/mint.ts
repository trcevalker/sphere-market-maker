/**
 * One-shot token minting script for testnet2.
 *
 * Usage:
 *   npm run mint              # mint default amounts (1000 UCT + 1000 ETH)
 *   UCT_AMOUNT=500 npm run mint
 *
 * Testnet has no faucet — you self-mint fungible tokens via the v2 engine.
 * Run this once before starting the agent so it has a balance to trade with.
 */

import { Sphere } from '@unicitylabs/sphere-sdk';
import { createNodeProviders } from '@unicitylabs/sphere-sdk/impl/nodejs';
import { config } from './config.js';

const UCT_AMOUNT  = BigInt(process.env['UCT_AMOUNT']  ?? '1000');
const ETH_AMOUNT  = BigInt(process.env['ETH_AMOUNT']  ?? '1000');

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
  console.log(`Wallet address: ${address}`);

  const payments = (sphere as any).payments;
  if (!payments) {
    console.error('Payments module not available. Make sure accounting: true is set.');
    process.exit(1);
  }

  console.log(`Minting ${UCT_AMOUNT} UCT...`);
  const uctResult = await payments.mintFungibleToken(config.baseCurrency, UCT_AMOUNT);
  console.log('UCT mint result:', JSON.stringify(uctResult, null, 2));

  console.log(`Minting ${ETH_AMOUNT} ETH...`);
  const ethResult = await payments.mintFungibleToken(config.quoteCurrency, ETH_AMOUNT);
  console.log('ETH mint result:', JSON.stringify(ethResult, null, 2));

  console.log('Done. You can now run: npm start');
  process.exit(0);
}

mint().catch((err: unknown) => {
  console.error('Mint failed:', String(err));
  process.exit(1);
});
