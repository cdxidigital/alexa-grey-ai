import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessConcierge } from './access.mjs';
test('no allowlist denies access',()=> assert.equal(canAccessConcierge('owner-1', ''),false));
test('allowlist matches exact user id',()=> assert.equal(canAccessConcierge('owner-1','owner-1, second-id'),true));
test('another signed-in user is denied',()=> assert.equal(canAccessConcierge('other-id','owner-1'),false));
test('no substring bypass',()=> assert.equal(canAccessConcierge('owner','owner-1'),false));
test('invalid user id is denied',()=> assert.equal(canAccessConcierge(null,'owner-1'),false));
