import http from 'node:http';
import { getRecentLogs } from './logger.js';

export interface StatusContext {
  address: string;
  pair: string;
  startedAt: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]!);
}

function renderPage(ctx: StatusContext): string {
  const logs = getRecentLogs().slice(-60).reverse();
  const rows = logs.map((l) => {
    const color = l.level === 'ERROR' ? '#ff5c5c' : l.level === 'WARN' ? '#ffb020' : '#9a9a9a';
    const { ts, level, event, ...rest } = l;
    const extra = Object.keys(rest).length ? escapeHtml(JSON.stringify(rest)) : '';
    return `<tr><td class="ts">${ts}</td><td style="color:${color}">${level}</td><td class="ev">${escapeHtml(event)}</td><td class="extra">${extra}</td></tr>`;
  }).join('\n');

  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="5">
<title>Sphere Market Maker — Status</title>
<style>
  body { background:#0B0B0C; color:#e8e8e8; font-family: -apple-system, Segoe UI, Arial, sans-serif; margin:0; padding:24px; }
  h1 { color:#FF6F00; font-size:20px; margin:0 0 4px; }
  .sub { color:#9a9a9a; font-size:13px; margin-bottom:16px; }
  .badge { display:inline-block; background:#FF6F00; color:#0B0B0C; font-weight:700; border-radius:4px; padding:2px 8px; font-size:12px; margin-right:8px; }
  table { border-collapse: collapse; width:100%; font-size:12px; }
  td { padding:4px 8px; border-bottom:1px solid #1e1e1e; vertical-align:top; }
  .ts { color:#666; white-space:nowrap; font-family: monospace; }
  .ev { font-weight:600; white-space:nowrap; }
  .extra { color:#8a8a8a; font-family: monospace; word-break: break-all; }
</style>
</head>
<body>
  <h1><span class="badge">LIVE</span>Sphere Market Maker</h1>
  <div class="sub">Address: ${escapeHtml(ctx.address)} &middot; Pair: ${escapeHtml(ctx.pair)} &middot; Running since ${escapeHtml(ctx.startedAt)} &middot; auto-refreshes every 5s</div>
  <table><tbody>
  ${rows || '<tr><td colspan="4">No events yet</td></tr>'}
  </tbody></table>
</body></html>`;
}

export function startStatusServer(port: number, getContext: () => StatusContext): void {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }
    if (req.url === '/api/status') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ...getContext(), logs: getRecentLogs().slice(-60) }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(renderPage(getContext()));
  });

  server.listen(port);
}
