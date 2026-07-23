import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  platform: 'web',
  secureStore: new Map<string, string>(),
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.platform;
    },
  },
}));

vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only',
  getItemAsync: vi.fn(async (key: string) => mocks.secureStore.get(key) ?? null),
  setItemAsync: vi.fn(
    async (key: string, value: string) => void mocks.secureStore.set(key, value),
  ),
  deleteItemAsync: vi.fn(async (key: string) => void mocks.secureStore.delete(key)),
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digestStringAsync: vi.fn(async () => 'fingerprint'),
}));

import * as SecureStore from 'expo-secure-store';
import {
  getCredential,
  migrateCredentialStorage,
  saveCredential,
  wipeAllCredentials,
} from '../src/services/secureCredentials';

describe('secure credentials', () => {
  beforeEach(async () => {
    mocks.platform = 'web';
    mocks.secureStore.clear();
    vi.clearAllMocks();
    await wipeAllCredentials();
  });

  it('keeps web credentials in session memory without persistent storage', async () => {
    await saveCredential('provider-1', ' secret ');

    expect(await getCredential('provider-1')).toBe('secret');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();

    await wipeAllCredentials();
    expect(await getCredential('provider-1')).toBeNull();
  });

  it('indexes native credentials and wipes them without provider metadata', async () => {
    mocks.platform = 'ios';

    await Promise.all([
      saveCredential('provider-1', 'secret-1'),
      saveCredential('provider-2', 'secret-2'),
    ]);

    expect(mocks.secureStore.get('tt_credential_ids_v1')).toBe(
      JSON.stringify(['provider-1', 'provider-2']),
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'tt_cred_provider-1',
      'secret-1',
      { keychainAccessible: 'when-unlocked-this-device-only' },
    );

    await wipeAllCredentials();

    expect(mocks.secureStore.size).toBe(0);
  });

  it('migrates and wipes credentials saved before the index existed', async () => {
    mocks.platform = 'ios';
    mocks.secureStore.set('tt_cred_legacy-provider', 'legacy-secret');

    await migrateCredentialStorage(['legacy-provider']);
    await wipeAllCredentials();

    expect(mocks.secureStore.size).toBe(0);
  });
});
