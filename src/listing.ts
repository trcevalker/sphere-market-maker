import { config } from './config.js';

// FeedListing type from the SDK is minimal; the live API returns extra fields.
// We cast to `any` to read the runtime extras (price, side, etc.).

export interface ParsedListing {
  id: string;
  agentName: string;    // e.g. "@chichi"
  agentId: string;
  side: 'buy' | 'sell';
  price: number;        // QUOTE per BASE (e.g. ETH per UCT)
  baseAmount: string;   // integer string: BASE units to trade
  quoteAmount: string;  // integer string: QUOTE units we send / receive
  raw: unknown;
}

// Attempts to extract price from API response fields or description text.
function extractPrice(listing: Record<string, unknown>): number | null {
  // Direct field (seen in live API)
  if (typeof listing['price'] === 'number') return listing['price'] as number;
  if (typeof listing['price'] === 'string') {
    const n = parseFloat(listing['price'] as string);
    if (!isNaN(n)) return n;
  }

  // Fall back: parse price from description (supports camelCase and snake_case field names)
  const desc = String(
    listing['descriptionPreview'] ?? listing['description_preview'] ??
    listing['description'] ?? listing['title'] ?? ''
  );
  const m = desc.match(/price=([\d.]+)/i) ?? desc.match(/(?:price|@)\s*([\d.]+)/i);
  if (m) {
    const n = parseFloat(m[1]);
    if (!isNaN(n)) return n;
  }

  return null;
}

function extractSide(listing: Record<string, unknown>): 'buy' | 'sell' | null {
  // Direct field
  const side = listing['side'] ?? listing['type'] ?? listing['intentType'];
  if (side === 'buy' || side === 'sell') return side as 'buy' | 'sell';
  return null;
}

// Compute the integer string QUOTE amount from price × baseAmount.
// Rounds up (never down) so any positive price/baseAmount pair yields a positive
// integer — Sphere's SWAP_INVALID_DEAL check rejects "0" (Math.round truncated small
// price×baseAmount products, e.g. 0.098963 × 5 = 0.49 → 0, to zero).
function deriveQuoteAmount(price: number, baseAmount: string): string {
  const base = parseInt(baseAmount, 10);
  return Math.max(1, Math.ceil(price * base)).toString();
}

export function parseListing(raw: unknown): ParsedListing | null {
  const l = raw as Record<string, unknown>;

  const id = String(l['id'] ?? '');
  // Support both camelCase (SDK internal) and snake_case (live market API / WebSocket)
  const agentName = String(l['agentName'] ?? l['agent_name'] ?? '');
  const agentId = String(l['agentId'] ?? l['agent_id'] ?? '');

  if (!id || !agentName) return null;

  const side = extractSide(l);
  if (!side) return null;

  const price = extractPrice(l);
  if (price === null || isNaN(price) || price <= 0) return null;

  // Use configured trade size; the listing's own base amount is informational
  const baseAmount = config.tradeAmountBase;
  const quoteAmount = deriveQuoteAmount(price, baseAmount);

  return { id, agentName, agentId, side, price, baseAmount, quoteAmount, raw };
}

export function listingMatchesRules(p: ParsedListing): boolean {
  // We only handle the configured pair
  // (Currency check relies on the listing having currency fields or being
  //  the only pair on testnet; add explicit currency filtering once the SDK
  //  exposes it on FeedListing.)

  if (p.side === 'sell') {
    // Counterparty is selling BASE, we buy BASE by sending QUOTE.
    // Only fill if their ask price is within our max buy price.
    return p.price <= config.maxBuyPrice;
  }

  if (p.side === 'buy') {
    // Counterparty is buying BASE, we sell BASE by receiving QUOTE.
    // Only fill if their bid price is within our min sell price.
    return p.price >= config.minSellPrice;
  }

  return false;
}
