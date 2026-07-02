import type { SphereEventMap, MarketModule, SwapModule, Identity } from '@unicitylabs/sphere-sdk';
import { config } from './config.js';
import { log } from './logger.js';
import { parseListing, listingMatchesRules, type ParsedListing } from './listing.js';

// FeedMessage is not re-exported by the SDK; derive it from the subscribeFeed signature.
type FeedMsg = Parameters<Parameters<MarketModule['subscribeFeed']>[0]>[0];

// Structural interface matching only what the agent needs from Sphere.
// Avoids the private-property type mismatch that arises when the Sphere class
// is resolved via two different module-resolution paths (Node16 ESM vs CJS).
interface SphereHandle {
  market: MarketModule | null;
  swap: SwapModule | null;
  identity: Identity | null;
  on<T extends keyof SphereEventMap>(
    type: T,
    handler: (data: SphereEventMap[T]) => void,
  ): () => void;
}

export class MarketMakingAgent {
  private sphere: SphereHandle;
  private myAddress: string = '';

  private activeSwaps = new Set<string>();
  private lastProposalAt = 0;
  private proposedListingIds = new Set<string>();

  constructor(sphere: SphereHandle) {
    this.sphere = sphere;
  }

  async start(): Promise<void> {
    this.myAddress = this.resolveOwnAddress();
    log.info('agent.started', {
      address: this.myAddress,
      pair: `${config.baseCurrency}/${config.quoteCurrency}`,
      maxBuyPrice: config.maxBuyPrice,
      minSellPrice: config.minSellPrice,
      tradeAmountBase: config.tradeAmountBase,
    });

    this.registerSwapEventHandlers();
    this.startMarketFeed();
  }

  // ── Identity ─────────────────────────────────────────────────────────────────

  private resolveOwnAddress(): string {
    const id =
      this.sphere.identity?.directAddress ??
      this.sphere.identity?.nametag ??
      '';

    if (!id) {
      log.warn('agent.identity_unknown', {
        hint: 'directAddress not set yet — proposeSwap partyA will be empty',
      });
    }
    return id;
  }

  // ── Market feed ──────────────────────────────────────────────────────────────

  private startMarketFeed(): void {
    const market = this.sphere.market;
    if (!market) {
      log.error('feed.no_market_module', { hint: 'Pass market: true to Sphere.init()' });
      return;
    }

    log.info('feed.subscribing');

    const unsubscribe = market.subscribeFeed((msg: FeedMsg) => {
      if (msg.type === 'initial') {
        log.info('feed.initial_batch', { count: msg.listings.length });
        for (const listing of msg.listings) {
          this.handleListing(listing);
        }
      } else {
        this.handleListing(msg.listing);
      }
    });

    process.on('SIGINT', () => {
      log.info('agent.stopping');
      unsubscribe();
      process.exit(0);
    });
  }

  // ── Listing evaluation ───────────────────────────────────────────────────────

  private handleListing(raw: unknown): void {
    const parsed = parseListing(raw);
    if (!parsed) return;

    log.debug('feed.listing_received', {
      id: parsed.id,
      agent: parsed.agentName,
      side: parsed.side,
      price: parsed.price,
    });

    if (!listingMatchesRules(parsed)) {
      log.debug('feed.listing_skipped', { id: parsed.id, reason: 'price_out_of_range', price: parsed.price });
      return;
    }
    if (this.proposedListingIds.has(parsed.id)) {
      log.debug('feed.listing_skipped', { id: parsed.id, reason: 'already_proposed' });
      return;
    }
    if (this.activeSwaps.size >= config.maxConcurrentSwaps) {
      log.warn('feed.listing_skipped', { id: parsed.id, reason: 'max_concurrent_swaps', active: this.activeSwaps.size });
      return;
    }
    if (Date.now() - this.lastProposalAt < config.proposalCooldownMs) {
      log.debug('feed.listing_skipped', { id: parsed.id, reason: 'cooldown' });
      return;
    }

    log.info('feed.listing_matched', {
      id: parsed.id,
      agent: parsed.agentName,
      side: parsed.side,
      price: parsed.price,
      baseAmount: parsed.baseAmount,
      quoteAmount: parsed.quoteAmount,
    });

    this.proposeSwap(parsed).catch((err: unknown) =>
      log.error('swap.propose_error', { listingId: parsed.id, error: String(err) }),
    );
  }

  // ── Swap proposal ─────────────────────────────────────────────────────────────

  private async proposeSwap(listing: ParsedListing): Promise<void> {
    const swap = this.sphere.swap;
    if (!swap) {
      log.error('swap.no_swap_module', { hint: 'Pass swap: true to Sphere.init()' });
      return;
    }

    this.lastProposalAt = Date.now();
    this.proposedListingIds.add(listing.id);

    // listing.side = 'sell' → counterparty sells BASE (sends BASE, wants QUOTE)
    //   → we send QUOTE, receive BASE  → partyA = us (QUOTE), partyB = them (BASE)
    //
    // listing.side = 'buy'  → counterparty buys BASE (sends QUOTE, wants BASE)
    //   → we send BASE, receive QUOTE  → partyA = us (BASE), partyB = them (QUOTE)

    const deal =
      listing.side === 'sell'
        ? {
            partyA: this.myAddress,
            partyACurrency: config.quoteCurrency,
            partyAAmount: listing.quoteAmount,
            partyB: listing.agentName,
            partyBCurrency: config.baseCurrency,
            partyBAmount: listing.baseAmount,
            timeout: config.swapTimeoutSecs,
          }
        : {
            partyA: this.myAddress,
            partyACurrency: config.baseCurrency,
            partyAAmount: listing.baseAmount,
            partyB: listing.agentName,
            partyBCurrency: config.quoteCurrency,
            partyBAmount: listing.quoteAmount,
            timeout: config.swapTimeoutSecs,
          };

    log.info('swap.proposing', { listingId: listing.id, counterparty: listing.agentName, deal });

    const result = await swap.proposeSwap(deal, {
      message: `Market-maker taker fill — listing ${listing.id}`,
    });

    this.activeSwaps.add(result.swapId);
    log.info('swap.proposed', { swapId: result.swapId, listingId: listing.id, counterparty: listing.agentName });
  }

  // ── Swap event handlers ───────────────────────────────────────────────────────

  private registerSwapEventHandlers(): void {
    const s = this.sphere;

    s.on('swap:proposal_received', (e) => {
      log.info('swap.proposal_received', { swapId: e.swapId, sender: e.senderNametag ?? e.senderPubkey });
      this.sphere.swap?.rejectSwap(e.swapId, 'agent is in taker-only mode').catch((err: unknown) =>
        log.error('swap.reject_error', { swapId: e.swapId, error: String(err) }),
      );
    });

    s.on('swap:accepted',     (e) => { log.info('swap.accepted',     { swapId: e.swapId, role: e.role }); });
    s.on('swap:deposit_sent', (e) => { log.info('swap.deposit_sent', { swapId: e.swapId }); });
    s.on('swap:concluding',   (e) => { log.info('swap.concluding',   { swapId: e.swapId }); });

    s.on('swap:completed', (e) => {
      log.info('swap.completed', { swapId: e.swapId, payoutVerified: e.payoutVerified });
      this.activeSwaps.delete(e.swapId);
    });

    s.on('swap:rejected', (e) => {
      log.warn('swap.rejected', { swapId: e.swapId, reason: e.reason ?? '' });
      this.activeSwaps.delete(e.swapId);
    });

    s.on('swap:cancelled', (e) => {
      log.warn('swap.cancelled', { swapId: e.swapId, reason: e.reason, depositsReturned: e.depositsReturned });
      this.activeSwaps.delete(e.swapId);
    });

    s.on('swap:failed', (e) => {
      log.error('swap.failed', { swapId: e.swapId, error: e.error });
      this.activeSwaps.delete(e.swapId);
    });
  }
}
