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
