import { Sphere } from '@unicitylabs/sphere-sdk';
import { createNodeProviders } from '@unicitylabs/sphere-sdk/impl/nodejs';
import { config } from './config.js';
import { log } from './logger.js';
import { MarketMakingAgent } from './agent.js';

async function main(): Promise<void> {
  log.info('sdk.init', { network: config.network, dataDir: config.dataDir });

  const providers = createNodeProviders({
    network: config.network,
    dataDir: config.dataDir,
    market: true,
    oracle: { apiKey: config.oracleApiKey },
  });

  const initResult = await Sphere.init({
    ...providers,
    network: config.network,
    ...(config.mnemonic ? { mnemonic: config.mnemonic } : { autoGenerate: true }),
    accounting: true,
    swap: { defaultEscrowAddress: config.escrowAddress },
    market: true,
    onProgress: (p) => log.debug('sdk.init_progress', { step: p.step }),
  });

  const sphere = initResult.sphere;

  // Log mnemonic whenever it's available — on first generate AND on every load
  // so the user can always recover it from logs.
  const mnemonic = initResult.generatedMnemonic ?? sphere.getMnemonic();
  if (mnemonic) {
    log.info('wallet.mnemonic', {
      mnemonic,
      action: 'SAVE THIS — set MNEMONIC= in .env to keep this wallet across runs',
    });
  }

  log.info('sdk.ready', {
    address: sphere.identity?.directAddress ?? sphere.identity?.nametag ?? 'unknown',
  });

  const agent = new MarketMakingAgent(sphere);
  await agent.start();
}

main().catch((err: unknown) => {
  log.error('fatal', { error: String(err), stack: (err as Error)?.stack });
  process.exit(1);
});
