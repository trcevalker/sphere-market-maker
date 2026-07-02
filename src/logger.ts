type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function emit(level: Level, event: string, data?: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  });
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
