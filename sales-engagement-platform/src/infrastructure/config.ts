import { z } from 'zod';

/** Strict boolean: only the literal strings "true" / "false" are accepted. */
const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true'));

const int = (fallback: number, min: number, max: number) => z.coerce.number().int().min(min).max(max).default(fallback);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TZ_DEFAULT: z.string().min(1).default('Asia/Tokyo'),
  DATABASE_URL: z.string().min(1).optional(),
  SESSION_SECRET: z.string().optional(),

  AI_VOICE_ENABLED: bool(false),
  AUTO_DIAL_ENABLED: bool(false),
  RECORDING_ENABLED: bool(false),
  HUMAN_HANDOFF_ENABLED: bool(false),
  // Engaged (= no outbound calls) unless an operator explicitly releases it.
  OUTBOUND_KILL_SWITCH: bool(true),
  WEBHOOK_SIGNATURE_BYPASS: bool(false),

  // Production safety limits. There is deliberately no "0 = unlimited" (audit R4).
  MAX_CALL_DURATION_SECONDS: int(900, 60, 3600),
  DAILY_CALL_LIMIT: int(100, 1, 100_000),
  MAX_CONCURRENT_CALLS: int(1, 1, 100),
  // 0 = not configured → the BUDGET guard denies (fail closed).
  TELEPHONY_BUDGET_YEN_PER_DAY: int(0, 0, 10_000_000),
  AI_BUDGET_YEN_PER_DAY: int(0, 0, 10_000_000),
  CALLING_HOURS_START: int(9, 0, 23),
  CALLING_HOURS_END: int(20, 1, 24),
  PROVIDER_FAILURE_THRESHOLD: int(5, 1, 100),
});

export type FeatureFlags = {
  AI_VOICE_ENABLED: boolean;
  AUTO_DIAL_ENABLED: boolean;
  RECORDING_ENABLED: boolean;
  HUMAN_HANDOFF_ENABLED: boolean;
};

export type SafetyLimits = Readonly<{
  maxCallDurationSeconds: number;
  dailyCallLimit: number;
  maxConcurrentCalls: number;
  telephonyBudgetYenPerDay: number;
  aiBudgetYenPerDay: number;
  callingHours: Readonly<{ start: number; end: number }>;
  providerFailureThreshold: number;
}>;

export type AppConfig = Readonly<{
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  logLevel: string;
  timezone: string;
  databaseUrl: string | undefined;
  sessionSecret: string | undefined;
  flags: Readonly<FeatureFlags>;
  outboundKillSwitch: boolean;
  webhookSignatureBypass: boolean;
  limits: SafetyLimits;
}>;

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
  constructor(
    message: string,
    readonly invalidKeys: readonly string[],
  ) {
    super(message);
  }
}

const MIN_SECRET_LENGTH = 32;

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    // Report key names only — values may be secrets.
    const keys = [...new Set(parsed.error.issues.map((i) => i.path.join('.')))];
    throw new ConfigError(`Invalid configuration for: ${keys.join(', ')}`, keys);
  }
  const e = parsed.data;

  if (e.CALLING_HOURS_START >= e.CALLING_HOURS_END) {
    throw new ConfigError('CALLING_HOURS_START must be earlier than CALLING_HOURS_END', [
      'CALLING_HOURS_START',
      'CALLING_HOURS_END',
    ]);
  }

  if (e.NODE_ENV === 'production') {
    if (e.WEBHOOK_SIGNATURE_BYPASS) {
      throw new ConfigError('WEBHOOK_SIGNATURE_BYPASS must never be enabled in production', [
        'WEBHOOK_SIGNATURE_BYPASS',
      ]);
    }
    if (!e.SESSION_SECRET || e.SESSION_SECRET.length < MIN_SECRET_LENGTH) {
      throw new ConfigError(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production`, [
        'SESSION_SECRET',
      ]);
    }
    // TODO(P6 Campaign/Queue + P5 Compliance): lift once rate limits, consent policy and
    // per-campaign pacing exist. Until then auto dial is unsafe by construction (ADR-0005).
    if (e.AUTO_DIAL_ENABLED) {
      throw new ConfigError('AUTO_DIAL_ENABLED cannot be enabled before compliance prerequisites ship', [
        'AUTO_DIAL_ENABLED',
      ]);
    }
  }

  return Object.freeze({
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    timezone: e.TZ_DEFAULT,
    databaseUrl: e.DATABASE_URL,
    sessionSecret: e.SESSION_SECRET,
    flags: Object.freeze({
      AI_VOICE_ENABLED: e.AI_VOICE_ENABLED,
      AUTO_DIAL_ENABLED: e.AUTO_DIAL_ENABLED,
      RECORDING_ENABLED: e.RECORDING_ENABLED,
      HUMAN_HANDOFF_ENABLED: e.HUMAN_HANDOFF_ENABLED,
    }),
    outboundKillSwitch: e.OUTBOUND_KILL_SWITCH,
    webhookSignatureBypass: e.WEBHOOK_SIGNATURE_BYPASS,
    limits: Object.freeze({
      maxCallDurationSeconds: e.MAX_CALL_DURATION_SECONDS,
      dailyCallLimit: e.DAILY_CALL_LIMIT,
      maxConcurrentCalls: e.MAX_CONCURRENT_CALLS,
      telephonyBudgetYenPerDay: e.TELEPHONY_BUDGET_YEN_PER_DAY,
      aiBudgetYenPerDay: e.AI_BUDGET_YEN_PER_DAY,
      callingHours: Object.freeze({ start: e.CALLING_HOURS_START, end: e.CALLING_HOURS_END }),
      providerFailureThreshold: e.PROVIDER_FAILURE_THRESHOLD,
    }),
  });
}

export type ClientSafeConfig = {
  flags: FeatureFlags;
  outboundHalted: boolean;
  timezone: string;
};

/** Allow-list projection: anything not named here can never reach a browser. */
export function toClientSafeConfig(cfg: AppConfig): ClientSafeConfig {
  return {
    flags: { ...cfg.flags },
    outboundHalted: cfg.outboundKillSwitch,
    timezone: cfg.timezone,
  };
}
