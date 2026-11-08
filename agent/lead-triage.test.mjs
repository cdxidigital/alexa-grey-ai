import test from 'node:test';
import assert from 'node:assert/strict';
import { triageEnquiry } from './lead-triage.mjs';
const good = {channel:'web',category:'collaboration',contact:'partner@example.org',purpose:'Discuss a brand partnership',timeline:'Next month',adultAttested:true};
test('valid contact qualifies only for human review', () => {
  const out=triageEnquiry(good);
  assert.equal(out.disposition,'qualified_for_human_review');
  assert.equal(out.contactValid,true);
  assert.equal(out.automaticBookingAllowed,false);
});
test('valid AU phone qualifies', () => assert.equal(triageEnquiry({...good,contact:'+61 412 345 678'}).contactValid,true));
test('spaces in email are not valid', () => assert.equal(triageEnquiry({...good,contact:'a b@example.com'}).contactValid,false));
test('contact with invalid domain is rejected', () => assert.equal(triageEnquiry({...good,contact:'not-an-email'}).contactValid,false));
test('missing purpose is routed to information request', () => assert.equal(triageEnquiry({...good,purpose:''}).disposition,'needs_information'));
test('unconfirmed adulthood cannot qualify', () => assert.equal(triageEnquiry({...good,adultAttested:false}).disposition,'needs_information'));
test('attestation is not verification', () => assert.equal(triageEnquiry(good).adultAttestationOnly,true));
test('safety overrides qualification and disables drafts', () => {
  const out=triageEnquiry({...good,threatOrHarassment:true});
  assert.equal(out.disposition,'safety_review');
  assert.deepEqual(out.authorizedActions,['queue_for_human']);
});
test('private information request escalates', () => assert.equal(triageEnquiry({...good,requestsPrivateInformation:true}).disposition,'safety_review'));
test('unapproved offer escalates', () => assert.equal(triageEnquiry({...good,requestsUnapprovedOffer:true}).disposition,'human_review'));
test('no raw contact or purpose in output', () => {
  const out=JSON.stringify(triageEnquiry(good));
  assert.equal(out.includes(good.contact),false);
  assert.equal(out.includes(good.purpose),false);
});
test('malformed inputs rejected', () => {
  for (const input of [null, [], 'no', 10]) assert.throws(() => triageEnquiry(input),TypeError);
});
test('overlong purpose needs more information', () => assert.equal(triageEnquiry({...good,purpose:'a'.repeat(700)}).disposition,'needs_information'));
test('unknown category falls back to other', () => assert.equal(triageEnquiry({...good,category:'booking'}).category,'other'));
