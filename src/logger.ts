type LogLevel = 'info' | 'warn' | 'error';

export class Logger {
  public info(event: string, meta?: Record<string, unknown>): void {
    this.log('info', event, meta);
  }

  public warn(event: string, meta?: Record<string, unknown>): void {
    this.log('warn', event, meta);
  }

  public error(event: string, meta?: Record<string, unknown>): void {
    this.log('error', event, meta);
  }

  private log(level: LogLevel, event: string, meta?: Record<string, unknown>): void {
    console.log(
      JSON.stringify({
        level,
        event,
        timestamp: new Date().toISOString(),
        ...(meta ?? {})
      })
    );
  }
}
