// The account's vault. AI keys are sealed with a key that only the account password can make, so the
// server keeps sealed text and never a key. The vault key is derived from the password and a salt kept
// on the profile: every device that signs in to the account makes the same key. It is kept on each
// device in the encrypted session store, so it is not asked for again until the account is signed out of.
// Everything here uses the browser's own crypto.

/** PBKDF2 rounds for the vault key. Slow enough that guessing a password takes a long time. */
export const VAULT_ROUNDS = 600_000;
/** The session-store key the vault is kept under on this device. */
export const VAULT_STORAGE_KEY = 'danna.vault';

const SALT_BYTES = 16;
const IV_BYTES = 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function newSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

/** The vault key for an account. The same password and salt always give the same key. */
export async function deriveVault(password: string, salt: Uint8Array<ArrayBuffer>, rounds = VAULT_ROUNDS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

// The provider is part of what is authenticated, so a sealed key cannot be moved to another provider.
const bindTo = (provider: string) => encoder.encode(`danna-ai-key:${provider}`);

/** Seals one AI key. The result is text: a random 12-byte nonce, then the encrypted key. */
export async function sealKey(vault: CryptoKey, provider: string, key: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const body = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: bindTo(provider) }, vault, encoder.encode(key));
  const sealed = new Uint8Array(IV_BYTES + body.byteLength);
  sealed.set(iv, 0);
  sealed.set(new Uint8Array(body), IV_BYTES);
  return toBase64(sealed);
}

/** Opens a sealed key. It fails when the password, the provider or the sealed text is not the right one. */
export async function openKey(vault: CryptoKey, provider: string, sealed: string): Promise<string> {
  const bytes = fromBase64(sealed);
  if (bytes.length <= IV_BYTES) throw new Error('The sealed key is too short.');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES), additionalData: bindTo(provider) },
    vault,
    bytes.slice(IV_BYTES),
  );
  return decoder.decode(plain);
}

/** The vault key as text, for the encrypted session store on this device. */
export async function exportVault(vault: CryptoKey): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.exportKey('raw', vault)));
}

export async function importVault(text: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64(text), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
