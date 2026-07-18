import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { maskCredential as maskCredentialPure } from '../utils/format';

/**
 * Offline encrypted credential vault.
 *
 * - Native (iOS/Android): OS Keychain / Keystore via expo-secure-store.
 * - Web (dev only): AES-GCM with a device-local key in localStorage.
 *   Production mobile builds do not rely on web storage.
 *
 * Zero telemetry: nothing here phones home. Keys are only read when you
 * refresh usage or validate a provider — and then only sent to that provider.
 */

const KEY_PREFIX = 'tt_cred_';
const WEB_MASTER_KEY = 'tt_web_master_v1';

function storeKey(providerId: string): string {
  // SecureStore keys must be alphanumeric + ._-
  return `${KEY_PREFIX}${providerId.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

async function getWebMasterKey(): Promise<CryptoKey> {
  const existing = localStorage.getItem(WEB_MASTER_KEY);
  if (existing) {
    const raw = Uint8Array.from(atob(existing), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  const raw = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(WEB_MASTER_KEY, btoa(String.fromCharCode(...raw)));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function webEncrypt(plaintext: string): Promise<string> {
  const key = await getWebMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function webDecrypt(blob: string): Promise<string> {
  const key = await getWebMasterKey();
  const combined = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plain);
}

export async function saveCredential(providerId: string, apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error('API key cannot be empty');
  }
  const key = storeKey(providerId);

  if (Platform.OS === 'web') {
    const encrypted = await webEncrypt(trimmed);
    localStorage.setItem(key, encrypted);
    return;
  }

  await SecureStore.setItemAsync(key, trimmed, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getCredential(providerId: string): Promise<string | null> {
  const key = storeKey(providerId);

  if (Platform.OS === 'web') {
    const blob = localStorage.getItem(key);
    if (!blob) return null;
    try {
      return await webDecrypt(blob);
    } catch {
      return null;
    }
  }

  return SecureStore.getItemAsync(key);
}

export async function deleteCredential(providerId: string): Promise<void> {
  const key = storeKey(providerId);

  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

/** Redact a key for UI display — never log the full value. */
export function maskCredential(apiKey: string | null | undefined): string {
  return maskCredentialPure(apiKey);
}

/** Hash for integrity checks without storing the key in plain metadata. */
export async function credentialFingerprint(apiKey: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, apiKey);
}
