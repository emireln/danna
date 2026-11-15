// Tests the account vault (src/lib/vault.ts): the same password gives the same key, a sealed key opens
// only with that password and for its own provider, and the vault key survives being kept and read back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveVault, exportVault, fromBase64, importVault, newSalt, openKey, sealKey, toBase64 } from '../src/lib/vault.ts';

// A low round count keeps these tests quick. The app uses VAULT_ROUNDS (600,000).
const ROUNDS = 1000;

test('a key sealed with the account password opens again, and only for the provider it was sealed for', async () => {
  const vault = await deriveVault('correct horse battery', newSalt(), ROUNDS);
  const sealed = await sealKey(vault, 'openai', 'sk-proj-abcdef1234567890');
  assert.doesNotMatch(sealed, /sk-proj/, 'the sealed text does not show the key');
  assert.equal(await openKey(vault, 'openai', sealed), 'sk-proj-abcdef1234567890');
  await assert.rejects(openKey(vault, 'anthropic', sealed), 'a sealed key cannot be moved to another provider');
});

test('the same password and salt make the same vault, and another password cannot open the keys', async () => {
  const salt = newSalt();
  const first = await deriveVault('one password', salt, ROUNDS);
  const sealed = await sealKey(first, 'deepseek', 'sk-deep-1234567890abcdef');
  const again = await deriveVault('one password', salt, ROUNDS);
  assert.equal(await openKey(again, 'deepseek', sealed), 'sk-deep-1234567890abcdef');
  const other = await deriveVault('another password', salt, ROUNDS);
  await assert.rejects(openKey(other, 'deepseek', sealed), 'a different password does not open the key');
});

test('each sealing uses a new nonce, so the same key never seals to the same text twice', async () => {
  const vault = await deriveVault('password', newSalt(), ROUNDS);
  const one = await sealKey(vault, 'gemini', 'AIzaSy-same-key-value-123456');
  const two = await sealKey(vault, 'gemini', 'AIzaSy-same-key-value-123456');
  assert.notEqual(one, two);
});

test('the vault key can be kept as text and read back on the same device', async () => {
  const vault = await deriveVault('password', newSalt(), ROUNDS);
  const sealed = await sealKey(vault, 'openrouter', 'sk-or-v1-abcdef');
  const restored = await importVault(await exportVault(vault));
  assert.equal(await openKey(restored, 'openrouter', sealed), 'sk-or-v1-abcdef');
});

test('base64 helpers give back the same bytes', () => {
  const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 255]);
  assert.deepEqual([...fromBase64(toBase64(bytes))], [...bytes]);
});
