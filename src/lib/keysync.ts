// Keeps the AI keys of this device and of the signed-in account in step. The account holds every key
// sealed (see vault.ts). This device keeps its own copy, protected by the operating system. The account
// wins for every provider it has, and a key that only this device has is saved to the account.
import type { AIConnection, Provider } from './types';

export interface AccountKey {
  provider: Provider;
  sealed: string;
  masked: string;
}

/** What the sync needs from the account and from this device. The app passes the real ones in. */
export interface KeySyncPort {
  listAccount(): Promise<AccountKey[]>;
  saveAccount(row: AccountKey): Promise<void>;
  connections(): Promise<AIConnection[]>;
  exportKey(provider: Provider): Promise<string>;
  importKey(provider: Provider, key: string): Promise<void>;
  markAccount(provider: Provider): Promise<void>;
  removeLocal(provider: Provider): Promise<void>;
  seal(provider: Provider, key: string): Promise<string>;
  open(provider: Provider, sealed: string): Promise<string>;
}

export interface KeySyncReport {
  /** Keys opened from the account and kept on this device. */
  imported: Provider[];
  /** Keys added on this device and saved, sealed, to the account. */
  uploaded: Provider[];
  /** Copies of account keys the account no longer has. They were removed from this device. */
  removed: Provider[];
  /** Keys in the account that this password cannot open. Add them again to replace them. */
  unreadable: Provider[];
}

export async function syncAccountKeys(port: KeySyncPort): Promise<KeySyncReport> {
  const report: KeySyncReport = { imported: [], uploaded: [], removed: [], unreadable: [] };
  const account = await port.listAccount();
  const inAccount = new Set(account.map((row) => row.provider));

  // The account is the source of truth for the providers it has.
  for (const row of account) {
    try {
      await port.importKey(row.provider, await port.open(row.provider, row.sealed));
      report.imported.push(row.provider);
    } catch {
      report.unreadable.push(row.provider);
    }
  }

  // Read the connections again, so keys imported above are known as account keys.
  for (const connection of await port.connections()) {
    const { provider } = connection;
    const unreadable = report.unreadable.includes(provider);
    if (connection.source === 'device' && (!inAccount.has(provider) || unreadable)) {
      const key = await port.exportKey(provider);
      await port.saveAccount({ provider, sealed: await port.seal(provider, key), masked: connection.masked });
      await port.markAccount(provider);
      report.uploaded.push(provider);
    } else if (connection.source === 'account' && !inAccount.has(provider)) {
      await port.removeLocal(provider);
      report.removed.push(provider);
    }
  }

  return report;
}
