import { describe, expect, it } from 'vitest';
import { maskCredential } from '../src/utils/format';

describe('maskCredential', () => {
  it('redacts middle of keys', () => {
    const masked = maskCredential('sk-abcdefghijklmnop');
    expect(masked.startsWith('sk-a')).toBe(true);
    expect(masked.includes('…')).toBe(true);
    expect(masked).not.toContain('efghijklmn');
  });

  it('handles empty', () => {
    expect(maskCredential(null)).toBe('—');
  });
});
