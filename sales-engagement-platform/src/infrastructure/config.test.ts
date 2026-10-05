import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, toClientSafeConfig } from './config.js';

describe('loadConfig', () => {
  it('minimal env: every risky feature flag is OFF and the outbound kill switch is ENGAGED', () => {
    const cfg = loadConfig({});
    expect(cfg.flags).toEqual({
      AI_VOICE_ENABLED: false,
      AUTO_DIAL_ENABLED: false,
      RECORDING_ENABLED: false,
      HUMAN_HANDOFF_ENABLED: false,
    });
    expect(cfg.outboundKillSwitch).toBe(true);
    expect(cfg.nodeEnv).toBe('development');
    expect(cfg.port).toBe(8080);
    expect(cfg.timezone).toBe('Asia/Tokyo');
  });

  it('parses booleans strictly ("true"/"false" only)', () => {
    expect(loadConfig({ AUTO_DIAL_ENABLED: 'true' }).flags.AUTO_DIAL_ENABLED).toBe(true);
    expect(() => loadConfig({ AUTO_DIAL_ENABLED: 'yes' })).toThrow(ConfigError);
    expect(() => loadConfig({ AUTO_DIAL_ENABLED: '1' })).toThrow(ConfigError);
  });

  it('kill switch must be explicitly released', () => {
    expect(loadConfig({ OUTBOUND_KILL_SWITCH: 'false' }).outboundKillSwitch).toBe(false);
  });

  it('rejects an invalid port and names the key without echoing the value', () => {
    try {
      loadConfig({ PORT: 'abc', SESSION_SECRET: 'super-secret-value-should-not-leak' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      const err = e as ConfigError;
      expect(err.invalidKeys).toContain('PORT');
      expect(err.message).not.toContain('abc');
      expect(err.message).not.toContain('super-secret');
    }
  });

  it('rejects unknown NODE_ENV', () => {
    expect(() => loadConfig({ NODE_ENV: 'staging-ish' })).toThrow(ConfigError);
  });

  it('refuses to start in production with webhook signature bypass enabled', () => {
    expect(() =>
      loadConfig({ NODE_ENV: 'production', WEBHOOK_SIGNATURE_BYPASS: 'true', SESSION_SECRET: 'x'.repeat(32) }),
    ).toThrow(/WEBHOOK_SIGNATURE_BYPASS/);
  });

  it('allows webhook signature bypass only outside production', () => {
    expect(loadConfig({ NODE_ENV: 'test', WEBHOOK_SIGNATURE_BYPASS: 'true' }).webhookSignatureBypass).toBe(true);
  });

  it('requires a strong SESSION_SECRET in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
    expect(loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) }).nodeEnv).toBe('production');
  });

  it('refuses AUTO_DIAL in production while the compliance prerequisites are not implemented', () => {
    expect(() =>
      loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32), AUTO_DIAL_ENABLED: 'true' }),
    ).toThrow(/AUTO_DIAL_ENABLED/);
  });
});

describe('toClientSafeConfig', () => {
  it('never exposes secrets', () => {
    const cfg = loadConfig({
      NODE_ENV: 'production',
      SESSION_SECRET: 's'.repeat(40),
      DATABASE_URL: 'postgres://u:p@h/db',
    });
    const safe = JSON.stringify(toClientSafeConfig(cfg));
    expect(safe).not.toContain('s'.repeat(40));
    expect(safe).not.toContain('postgres://');
    expect(safe).not.toMatch(/secret|database/i);
  });

  it('exposes only what the UI needs', () => {
    const safe = toClientSafeConfig(loadConfig({ HUMAN_HANDOFF_ENABLED: 'true' }));
    expect(safe).toEqual({
      flags: {
        AI_VOICE_ENABLED: false,
        AUTO_DIAL_ENABLED: false,
        RECORDING_ENABLED: false,
        HUMAN_HANDOFF_ENABLED: true,
      },
      outboundHalted: true,
      timezone: 'Asia/Tokyo',
    });
  });
});

describe('production safety limits (Phase 0 delta)', () => {
  it('safe defaults when nothing is configured — never "unlimited"', () => {
    expect(loadConfig({}).limits).toEqual({
      maxCallDurationSeconds: 900,
      dailyCallLimit: 100,
      maxConcurrentCalls: 1,
      telephonyBudgetYenPerDay: 0,
      aiBudgetYenPerDay: 0,
      callingHours: { start: 9, end: 20 },
      providerFailureThreshold: 5,
    });
  });

  it('accepts explicit valid values', () => {
    const l = loadConfig({
      DAILY_CALL_LIMIT: '300',
      MAX_CONCURRENT_CALLS: '4',
      TELEPHONY_BUDGET_YEN_PER_DAY: '5000',
      CALLING_HOURS_START: '10',
      CALLING_HOURS_END: '19',
    }).limits;
    expect(l.dailyCallLimit).toBe(300);
    expect(l.maxConcurrentCalls).toBe(4);
    expect(l.telephonyBudgetYenPerDay).toBe(5000);
    expect(l.callingHours).toEqual({ start: 10, end: 19 });
  });

  it.each([
    ['DAILY_CALL_LIMIT', '0'],
    ['DAILY_CALL_LIMIT', '-1'],
    ['DAILY_CALL_LIMIT', '1.5'],
    ['DAILY_CALL_LIMIT', '100001'],
    ['MAX_CONCURRENT_CALLS', '0'],
    ['MAX_CALL_DURATION_SECONDS', 'abc'],
    ['MAX_CALL_DURATION_SECONDS', '99999'],
    ['TELEPHONY_BUDGET_YEN_PER_DAY', '-1'],
    ['AI_BUDGET_YEN_PER_DAY', 'x'],
    ['CALLING_HOURS_END', '25'],
    ['PROVIDER_FAILURE_THRESHOLD', '0'],
  ])('%s=%s is rejected (there is no "0 = unlimited")', (key, value) => {
    try {
      loadConfig({ [key]: value });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).invalidKeys).toContain(key);
    }
  });

  it('calling hours must form a non-empty window', () => {
    expect(() => loadConfig({ CALLING_HOURS_START: '20', CALLING_HOURS_END: '20' })).toThrow(/CALLING_HOURS/);
    expect(() => loadConfig({ CALLING_HOURS_START: '21', CALLING_HOURS_END: '9' })).toThrow(/CALLING_HOURS/);
  });

  it('limits are not exposed to the browser', () => {
    expect(JSON.stringify(toClientSafeConfig(loadConfig({})))).not.toMatch(/limit|budget|duration/i);
  });
});
