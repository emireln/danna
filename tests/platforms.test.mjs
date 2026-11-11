// Tests how learning links are matched to platforms and how pasted links are checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLinkUrl, platformForUrl } from '../src/lib/platforms.ts';

test('a link is matched to its platform by host, subdomains and short links included', () => {
  assert.equal(platformForUrl('https://www.youtube.com/watch?v=abc').id, 'youtube');
  assert.equal(platformForUrl('https://youtu.be/abc').id, 'youtube');
  assert.equal(platformForUrl('https://m.youtube.com/watch?v=abc').id, 'youtube');
  assert.equal(platformForUrl('https://www.alura.com.br/curso').id, 'alura');
  assert.equal(platformForUrl('https://open.spotify.com/episode/x').id, 'spotify');
  assert.equal(platformForUrl('https://example.org/page').id, 'other');
  assert.equal(platformForUrl('not a link').id, 'other');
});

test('a pasted link is completed with https and checked', () => {
  assert.equal(normalizeLinkUrl('youtube.com/watch?v=abc'), 'https://youtube.com/watch?v=abc');
  assert.equal(normalizeLinkUrl('  https://youtu.be/abc  '), 'https://youtu.be/abc');
  assert.equal(normalizeLinkUrl('http://insecure.example'), null);
  assert.equal(normalizeLinkUrl('javascript:alert(1)'), null);
  assert.equal(normalizeLinkUrl(''), null);
});
