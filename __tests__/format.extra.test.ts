import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createId,
  formatRelativeTime,
  formatTokens,
  formatUsd,
  maskCredential,
} from '../src/utils/format';

describe('formatUsd edge cases', () => {
  it('formats tiny amounts with 4 decimals', () => {
    expect(formatUsd(0.0012)).toBe('$0.0012');
  });

  it('handles NaN', () => {
    expect(formatUsd(Number.NaN)).toBe('—');
  });
});

describe('formatTokens edge cases', () => {
  it('keeps small counts raw', () => {
    expect(formatTokens(42)).toBe('42');
  });

  it('handles NaN', () => {
    expect(formatTokens(Number.NaN)).toBe('—');
  });
});

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns never for empty/invalid', () => {
    expect(formatRelativeTime(null)).toBe('never');
    expect(formatRelativeTime(undefined)).toBe('never');
    expect(formatRelativeTime('not-a-date')).toBe('never');
  });

  it('buckets just now / minutes / hours / days', () => {
    const now = new Date('2026-07-10T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(formatRelativeTime(new Date(now.getTime() - 10_000).toISOString())).toBe(
      'just now',
    );
    expect(formatRelativeTime(new Date(now.getTime() - 5 * 60_000).toISOString())).toBe(
      '5m ago',
    );
    expect(
      formatRelativeTime(new Date(now.getTime() - 3 * 60 * 60_000).toISOString()),
    ).toBe('3h ago');
    expect(
      formatRelativeTime(new Date(now.getTime() - 3 * 24 * 60 * 60_000).toISOString()),
    ).toBe('3d ago');
  });
});

describe('createId', () => {
  it('returns unique-ish provider ids', () => {
    const a = createId();
    const b = createId();
    expect(a).toMatch(/^p_/);
    expect(b).toMatch(/^p_/);
    expect(a).not.toBe(b);
  });
});

describe('maskCredential', () => {
  it('fully masks short secrets', () => {
    expect(maskCredential('short')).toBe('••••••••');
  });
});
