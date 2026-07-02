import { WebSocket } from 'ws';
import { Sphere } from '@unicitylabs/sphere-sdk';
import { createNodeProviders } from '@unicitylabs/sphere-sdk/impl/nodejs';
import { config } from './config.js';
import { log } from './logger.js';
import { MarketMakingAgent } from './agent.js';
import { startStatusServer } from './statusServer.js';

// The SDK's market feed expects a global WebSocket (native in Node 22+, absent on
// older Node runtimes like Railway's Nixpacks default). Polyfill with `ws`, which is
// already a direct dependency, so this works regardless of the host Node version.
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;
}

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

  const address = sphere.identity?.directAddress ?? sphere.identity?.nametag ?? 'unknown';
  log.info('sdk.ready', { address });

  const startedAt = new Date().toISOString();
  startStatusServer(config.port, () => ({
    address,
    pair: `${config.baseCurrency}/${config.quoteCurrency}`,
    startedAt,
  }));
  log.info('status.listening', { port: config.port });

  const agent = new MarketMakingAgent(sphere);
  await agent.start();
}

main().catch((err: unknown) => {
  log.error('fatal', { error: String(err), stack: (err as Error)?.stack });
  process.exit(1);
});
