import { EnvironmentName } from '../enums/environment-name.enum';

/**
 * Step logger. Every client call and test step is written to stdout with an
 * incrementing step number, so when a test fails the last printed line shows
 * exactly which action ran last and which one failed.
 *
 * Output looks like:
 *   [dev|w0] #03 ▶ POST http://localhost:3000/dev/users
 *   [dev|w0] #03 ✔ 201 Created in 12ms
 *   [dev|w0] #04 ✖ FAILED expected 404 but got 500
 */
export type LogLevel = 'START' | 'OK' | 'FAIL' | 'INFO';

export class Logger {
  private static counter: number = 0;

  /** Resets the step counter; called at the start of each test by the fixture. */
  public static reset(): void {
    Logger.counter = 0;
  }

  /** Logs the beginning of an action and returns its step number. */
  public static start(message: string): number {
    Logger.counter += 1;
    Logger.write('START', Logger.counter, message);
    return Logger.counter;
  }

  public static success(stepNumber: number, message: string): void {
    Logger.write('OK', stepNumber, message);
  }

  public static failure(stepNumber: number, message: string): void {
    Logger.write('FAIL', stepNumber, message);
  }

  public static info(message: string): void {
    Logger.write('INFO', Logger.counter, message);
  }

  private static write(level: LogLevel, step: number, message: string): void {
    const icon: Record<LogLevel, string> = { START: '▶', OK: '✔', FAIL: '✖', INFO: '•' };
    const env: string = process.env.TEST_ENV ?? EnvironmentName.DEV;
    const worker: string = process.env.TEST_WORKER_INDEX ?? '0';
    const num: string = String(step).padStart(2, '0');
    console.log(`[${env}|w${worker}] #${num} ${icon[level]} ${message}`);
  }
}
