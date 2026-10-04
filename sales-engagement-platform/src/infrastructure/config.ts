import { z } from 'zod';

/** Strict boolean: only the literal strings "true" / "false" are accepted. */
const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true'));

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
});

export type FeatureFlags = {
  AI_VOICE_ENABLED: boolean;
  AUTO_DIAL_ENABLED: boolean;
  RECORDING_ENABLED: boolean;
  HUMAN_HANDOFF_ENABLED: boolean;
};

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
