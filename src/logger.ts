type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogEntry {
  ts: string;
  level: Level;
  event: string;
  [key: string]: unknown;
}

const RING_SIZE = 200;
const recent: LogEntry[] = [];

export function getRecentLogs(): readonly LogEntry[] {
  return recent;
}

function emit(level: Level, event: string, data?: Record<string, unknown>): void {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  };

  recent.push(entry);
  if (recent.length > RING_SIZE) recent.shift();

  const line = JSON.stringify(entry);
  if (level === 'ERROR') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const log = {
  info:  (event: string, data?: Record<string, unknown>) => emit('INFO',  event, data),
  warn:  (event: string, data?: Record<string, unknown>) => emit('WARN',  event, data),
  error: (event: string, data?: Record<string, unknown>) => emit('ERROR', event, data),
  debug: (event: string, data?: Record<string, unknown>) => emit('DEBUG', event, data),
};
