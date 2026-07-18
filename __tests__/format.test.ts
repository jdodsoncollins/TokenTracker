import { describe, expect, it } from 'vitest';
import { formatTokens, formatUsd } from '../src/utils/format';

describe('formatUsd', () => {
  it('formats dollars', () => {
    expect(formatUsd(12.4)).toMatch(/\$12\.40/);
  });
  it('handles null', () => {
    expect(formatUsd(null)).toBe('—');
  });
  it('handles zero', () => {
    expect(formatUsd(0)).toBe('$0.00');
  });
});

describe('formatTokens', () => {
  it('compacts thousands', () => {
    expect(formatTokens(1500)).toBe('1.5K');
  });
  it('compacts millions', () => {
    expect(formatTokens(2_500_000)).toBe('2.50M');
  });
  it('handles null', () => {
    expect(formatTokens(null)).toBe('—');
  });
});
