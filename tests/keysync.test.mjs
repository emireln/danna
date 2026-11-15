// Tests the sync between this device's AI keys and the account's (src/lib/keysync.ts). The account and the
// device are in-memory fakes; the sealing is the real vault.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncAccountKeys } from '../src/lib/keysync.ts';
import { deriveVault, newSalt, openKey, sealKey } from '../src/lib/vault.ts';

const ROUNDS = 1000;
const mask = (key) => `${key.slice(0, 7)}…${key.slice(-4)}`;

// device: provider -> { key, source }. account: rows as the database holds them.
function world(vault, { device = {}, account = [] } = {}) {
  const local = Object.fromEntries(Object.entries(device).map(([provider, entry]) => [provider, { ...entry, masked: mask(entry.key) }]));
  const remote = account.map((row) => ({ ...row }));
  const port = {
    listAccount: async () => remote.map((row) => ({ ...row })),
    saveAccount: async (row) => {
      const index = remote.findIndex((item) => item.provider === row.provider);
      if (index >= 0) remote[index] = { ...row };
      else remote.push({ ...row });
    },
    connections: async () =>
      Object.entries(local).map(([provider, entry]) => ({ provider, label: provider, masked: entry.masked, addedAt: '', source: entry.source })),
    exportKey: async (provider) => local[provider].key,
    importKey: async (provider, key) => {
      local[provider] = { key, masked: mask(key), source: 'account' };
    },
    markAccount: async (provider) => {
      local[provider].source = 'account';
    },
    removeLocal: async (provider) => {
      delete local[provider];
    },
    seal: (provider, key) => sealKey(vault, provider, key),
    open: (provider, sealed) => openKey(vault, provider, sealed),
  };
  return { port, local, remote };
}

const sealedFor = (vault, provider, key) => sealKey(vault, provider, key);

test('a key added on this device is saved to the account, sealed, and kept here as an account key', async () => {
  const vault = await deriveVault('password', newSalt(), ROUNDS);
  const { port, local, remote } = world(vault, { device: { openai: { key: 'sk-proj-device-key-0001', source: 'device' } } });

  const report = await syncAccountKeys(port);

  assert.deepEqual(report.uploaded, ['openai']);
  assert.equal(remote.length, 1);
  assert.doesNotMatch(remote[0].sealed, /sk-proj/, 'the account holds no readable key');
  assert.equal(await openKey(vault, 'openai', remote[0].sealed), 'sk-proj-device-key-0001');
  assert.equal(local.openai.source, 'account');
});

test('a key saved in the account is brought to a device that does not have it', async () => {
  const vault = await deriveVault('password', newSalt(), ROUNDS);
  const account = [{ provider: 'anthropic', sealed: await sealedFor(vault, 'anthropic', 'sk-ant-api03-saved-0002'), masked: 'sk-ant-…0002' }];
  const { port, local } = world(vault, { account });

  const report = await syncAccountKeys(port);

  assert.deepEqual(report.imported, ['anthropic']);
  assert.equal(local.anthropic.key, 'sk-ant-api03-saved-0002');
  assert.equal(local.anthropic.source, 'account');
  assert.deepEqual(report.uploaded, []);
});

test('a copy of an account key is removed here when the account no longer has it, and a device key stays and is saved', async () => {
  const vault = await deriveVault('password', newSalt(), ROUNDS);
  const { port, local } = world(vault, {
    device: {
      deepseek: { key: 'sk-deep-removed-on-another-device', source: 'account' },
      openai: { key: 'sk-proj-typed-here-0003', source: 'device' },
    },
  });

  const report = await syncAccountKeys(port);

  assert.deepEqual(report.removed, ['deepseek']);
  assert.equal(local.deepseek, undefined);
  assert.deepEqual(report.uploaded, ['openai']);
});

test('the account wins for a provider it has: this device takes the saved key', async () => {
  const vault = await deriveVault('password', newSalt(), ROUNDS);
  const account = [{ provider: 'openai', sealed: await sealedFor(vault, 'openai', 'sk-proj-from-account-0004'), masked: 'sk-proj…0004' }];
  const { port, local } = world(vault, { device: { openai: { key: 'sk-proj-older-device-0005', source: 'device' } }, account });

  const report = await syncAccountKeys(port);

  assert.deepEqual(report.imported, ['openai']);
  assert.deepEqual(report.uploaded, []);
  assert.equal(local.openai.key, 'sk-proj-from-account-0004');
});

test('a saved key this password cannot open is reported, and the key typed here replaces it in the account', async () => {
  const mine = await deriveVault('my password', newSalt(), ROUNDS);
  const theirs = await deriveVault('a password from before a reset', newSalt(), ROUNDS);
  const account = [{ provider: 'gemini', sealed: await sealedFor(theirs, 'gemini', 'AIzaSy-old-key-from-before-0006'), masked: 'AIzaSy…0006' }];
  const { port, local, remote } = world(mine, { device: { gemini: { key: 'AIzaSy-typed-again-0007', source: 'device' } }, account });

  const report = await syncAccountKeys(port);

  assert.deepEqual(report.unreadable, ['gemini']);
  assert.deepEqual(report.uploaded, ['gemini']);
  assert.equal(local.gemini.key, 'AIzaSy-typed-again-0007', 'this device keeps the key it has');
  assert.equal(await openKey(mine, 'gemini', remote[0].sealed), 'AIzaSy-typed-again-0007', 'the account now holds it, sealed with this password');
});
