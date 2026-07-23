import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { maskCredential as maskCredentialPure } from '../utils/format';

/**
 * Offline encrypted credential vault.
 *
 * - Native (iOS/Android): OS Keychain / Keystore via expo-secure-store.
 * - Web: session-only memory. A reload discards every credential.
 *
 * Zero telemetry: nothing here phones home. Keys are only read when you
 * refresh usage or validate a provider — and then only sent to that provider.
 */

const KEY_PREFIX = 'tt_cred_';
const CREDENTIAL_INDEX_KEY = 'tt_credential_ids_v1';
const LEGACY_WEB_MASTER_KEY = 'tt_web_master_v1';
const secureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const webCredentials = new Map<string, string>();
let credentialMutation = Promise.resolve();

function storeKey(providerId: string): string {
  // SecureStore keys must be alphanumeric + ._-
  return `${KEY_PREFIX}${providerId.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

function runCredentialMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = credentialMutation.then(operation);
  credentialMutation = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function loadCredentialIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(CREDENTIAL_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

async function saveCredentialIndex(ids: string[]): Promise<void> {
  await SecureStore.setItemAsync(
    CREDENTIAL_INDEX_KEY,
    JSON.stringify(ids),
    secureStoreOptions,
  );
}

function clearLegacyWebStorage(providerIds: string[]): void {
  if (typeof localStorage === 'undefined') return;
  for (const id of providerIds) localStorage.removeItem(storeKey(id));
  localStorage.removeItem(LEGACY_WEB_MASTER_KEY);
}

/** Register credentials written before the secure-store index existed. */
export async function migrateCredentialStorage(providerIds: string[]): Promise<void> {
  if (Platform.OS === 'web') {
    clearLegacyWebStorage(providerIds);
    return;
  }

  await runCredentialMutation(async () => {
    const ids = await loadCredentialIndex();
    const merged = [...new Set([...ids, ...providerIds])];
    if (merged.length !== ids.length) await saveCredentialIndex(merged);
  });
}

export async function saveCredential(providerId: string, apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error('API key cannot be empty');
  }
  const key = storeKey(providerId);

  if (Platform.OS === 'web') {
    webCredentials.set(key, trimmed);
    return;
  }

  await runCredentialMutation(async () => {
    const ids = await loadCredentialIndex();
    if (!ids.includes(providerId)) {
      await saveCredentialIndex([...ids, providerId]);
    }
    await SecureStore.setItemAsync(key, trimmed, secureStoreOptions);
  });
}

export async function getCredential(providerId: string): Promise<string | null> {
  const key = storeKey(providerId);

  if (Platform.OS === 'web') {
    return webCredentials.get(key) ?? null;
  }

  return SecureStore.getItemAsync(key);
}

export async function deleteCredential(providerId: string): Promise<void> {
  const key = storeKey(providerId);

  if (Platform.OS === 'web') {
    webCredentials.delete(key);
    return;
  }

  await runCredentialMutation(async () => {
    await SecureStore.deleteItemAsync(key);
    const ids = await loadCredentialIndex();
    if (ids.includes(providerId)) {
      await saveCredentialIndex(ids.filter((id) => id !== providerId));
    }
  });
}

export async function wipeAllCredentials(providerIds: string[] = []): Promise<void> {
  if (Platform.OS === 'web') {
    webCredentials.clear();
    clearLegacyWebStorage(providerIds);
    return;
  }

  await runCredentialMutation(async () => {
    const ids = [...new Set([...(await loadCredentialIndex()), ...providerIds])];
    for (const id of ids) {
      // Keep the index until every deletion succeeds so callers can retry a failed wipe.
      // eslint-disable-next-line no-await-in-loop
      await SecureStore.deleteItemAsync(storeKey(id));
    }
    await SecureStore.deleteItemAsync(CREDENTIAL_INDEX_KEY);
  });
}

/** Redact a key for UI display — never log the full value. */
export function maskCredential(apiKey: string | null | undefined): string {
  return maskCredentialPure(apiKey);
}

/** Hash for integrity checks without storing the key in plain metadata. */
export async function credentialFingerprint(apiKey: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, apiKey);
}
