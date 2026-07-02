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
  });

  const initResult = await Sphere.init({
    ...providers,
    ...(config.mnemonic ? { mnemonic: config.mnemonic } : { autoGenerate: true }),
    swap: true,
    market: true,
    onProgress: (p) => log.debug('sdk.init_progress', { step: p.step }),
  });

  const sphere = initResult.sphere;

  if (initResult.generatedMnemonic) {
    log.info('wallet.generated', {
      mnemonic: initResult.generatedMnemonic,
      action: 'SAVE THIS — add it as MNEMONIC= in your .env to reuse this wallet',
    });
  }

  log.info('sdk.ready');

  const agent = new MarketMakingAgent(sphere);
  await agent.start();
}

main().catch((err: unknown) => {
  log.error('fatal', { error: String(err), stack: (err as Error)?.stack });
  process.exit(1);
});
