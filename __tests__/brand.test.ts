import { describe, expect, it } from 'vitest';
import { brand } from '../src/theme/brand';
import { PROVIDER_ORDER } from '../src/services/providers/catalog';

describe('brand tokens', () => {
  it('defines provider colors for every catalog kind', () => {
    for (const kind of PROVIDER_ORDER) {
      expect(brand.providers[kind]).toMatch(/^#/);
    }
  });

  it('keeps primary and privacy accents defined', () => {
    expect(brand.primary).toBeTruthy();
    expect(brand.privacy).toBeTruthy();
    expect(brand.danger).toBeTruthy();
  });
});
