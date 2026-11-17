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
  assert.equal(platformForUrl('https://www.instagram.com/reel/abc/').id, 'instagram');
  assert.equal(platformForUrl('https://instagr.am/p/abc').id, 'instagram');
  assert.equal(platformForUrl('https://www.tiktok.com/@teacher/video/123').id, 'tiktok');
  assert.equal(platformForUrl('https://vm.tiktok.com/ZMabc/').id, 'tiktok');
  assert.equal(platformForUrl('https://x.com/teacher/status/1').id, 'x');
  assert.equal(platformForUrl('https://twitter.com/teacher').id, 'x');
  assert.equal(platformForUrl('https://fb.watch/abc').id, 'facebook');
  assert.equal(platformForUrl('https://www.dailymotion.com/video/x1').id, 'dailymotion');
  assert.equal(platformForUrl('https://en.wikipedia.org/wiki/Tea').id, 'wikipedia');
  assert.equal(platformForUrl('https://ex.com/page').id, 'other', 'a host that only ends in the letters x.com is not X');
  assert.equal(platformForUrl('https://notx.com/page').id, 'other');
});

test('a pasted link is completed with https and checked', () => {
  assert.equal(normalizeLinkUrl('youtube.com/watch?v=abc'), 'https://youtube.com/watch?v=abc');
  assert.equal(normalizeLinkUrl('  https://youtu.be/abc  '), 'https://youtu.be/abc');
  assert.equal(normalizeLinkUrl('http://insecure.example'), null);
  assert.equal(normalizeLinkUrl('javascript:alert(1)'), null);
  assert.equal(normalizeLinkUrl(''), null);
});
