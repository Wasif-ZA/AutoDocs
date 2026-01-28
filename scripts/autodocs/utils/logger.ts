import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: Date;
}

class Logger {
  private level: LogLevel = 'info';
  private entries: LogEntry[] = [];
  private isCI = process.env.CI === 'true';

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const prefix = this.isCI ? `[${timestamp}]` : '';

    const colors: Record<LogLevel, (s: string) => string> = {
      debug: chalk.gray,
      info: chalk.blue,
      warn: chalk.yellow,
      error: chalk.red,
      silent: (s) => s,
    };

    const icons: Record<LogLevel, string> = {
      debug: '[DEBUG]',
      info: '[INFO]',
      warn: '[WARN]',
      error: '[ERROR]',
      silent: '',
    };

    let formatted = `${prefix}${icons[level]} ${colors[level](message)}`;

    if (context && Object.keys(context).length > 0) {
      formatted += '\n' + chalk.gray(JSON.stringify(context, null, 2));
    }

    return formatted;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = { level, message, context, timestamp: new Date() };
    this.entries.push(entry);

    if (this.shouldLog(level)) {
      const formatted = this.formatMessage(level, message, context);
      if (level === 'error') {
        console.error(formatted);
      } else {
        console.log(formatted);
      }
    }
  }

  // Progress indicator for long operations
  progress(current: number, total: number, label: string): void {
    if (this.isCI) {
      // Simple output for CI
      this.info(`[${current}/${total}] ${label}`);
    } else {
      // Overwrite line for local dev
      const percent = Math.round((current / total) * 100);
      const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
      process.stdout.write(`\r${bar} ${percent}% | ${label}`.padEnd(80));
      if (current === total) process.stdout.write('\n');
    }
  }

  // Get all entries for reporting
  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  // Summary at end of run
  summary(): { errors: number; warnings: number; info: number } {
    return {
      errors: this.entries.filter(e => e.level === 'error').length,
      warnings: this.entries.filter(e => e.level === 'warn').length,
      info: this.entries.filter(e => e.level === 'info').length,
    };
  }

  // Clear entries for fresh start
  clear(): void {
    this.entries = [];
  }
}

export const logger = new Logger();
