// Shared reports: a report another person took is treated as theirs, not as the viewer's own.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;

before(async () => {
  server = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true, hmr: false } });
});

after(async () => {
  await server?.close();
});

test('a report is shared only when another person took the test', async () => {
  const { isSharedReport } = await server.ssrLoadModule('/src/lib/reports.ts');
  assert.equal(isSharedReport('ana', 'emir'), true);
  assert.equal(isSharedReport('emir', 'emir'), false);
  assert.equal(isSharedReport('ana', null), false, 'without a profile the report is not treated as shared');
});
