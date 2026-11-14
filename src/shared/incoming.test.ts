// Run: node src/shared/incoming.test.ts
import assert from 'node:assert/strict';
import { holdShare, sharedText, takeShare } from './incoming.ts';
import { LIMITS } from './types.ts';

// The first text (or bare link) wins, trimmed; images and files are not messages.
assert.equal(sharedText([{ value: '  Your MCB account is blocked  ', shareType: 'text' }]), 'Your MCB account is blocked');
assert.equal(sharedText([{ value: 'https://mcb-secure-login.com', shareType: 'url' }]), 'https://mcb-secure-login.com');
assert.equal(sharedText([{ value: 'file:///photo.jpg', shareType: 'image' }, { value: 'hi', shareType: 'text' }]), 'hi');
for (const none of [[], [{ value: '   ', shareType: 'text' }], [{ value: 'content://x', shareType: 'file' }], [{ shareType: 'text' }]])
  assert.equal(sharedText(none), null, JSON.stringify(none));

// Capped like /api/scan, so a huge share never turns into a 400.
assert.equal(sharedText([{ value: 'a'.repeat(LIMITS.text + 50), shareType: 'text' }])!.length, LIMITS.text);

// Scan takes it once; a later empty read (re-render, cleared payload) never wipes a pending share.
assert.equal(takeShare(), null);
holdShare('scam text');
holdShare(null);
assert.equal(takeShare(), 'scam text');
assert.equal(takeShare(), null, 'only once');

console.log('incoming ok');
