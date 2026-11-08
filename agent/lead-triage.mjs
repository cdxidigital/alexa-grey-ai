/** Deterministic, privacy-minimising intake for the INTERNAL Ellie May preview. */
const CHANNELS = new Set(['web', 'phone', 'email']);
const CATEGORIES = new Set(['general', 'media', 'collaboration', 'technical', 'other']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ()-]{8,24}$/;
const MISSING = ['missing_or_invalid_contact', 'missing_purpose', 'missing_timeline', 'adult_status_unconfirmed'];

export function triageEnquiry(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Enquiry must be an object');
  const channel = CHANNELS.has(input.channel) ? input.channel : 'web';
  const category = CATEGORIES.has(input.category) ? input.category : 'other';
  const contact = typeof input.contact === 'string' ? input.contact.trim() : '';
  const digits = contact.replace(/[^0-9]/g, '');
  const validContact = (contact.length <= 254 && EMAIL.test(contact)) ||
    (PHONE.test(contact) && digits.length >= 8 && digits.length <= 15);
  const hasPurpose = typeof input.purpose === 'string' && input.purpose.trim().length >= 12 && input.purpose.length <= 500;
  const hasTimeline = typeof input.timeline === 'string' && input.timeline.trim().length > 0 && input.timeline.length <= 80;
  const attested = input.adultAttested === true;
  const flags = [];
  if (!validContact) flags.push(MISSING[0]);
  if (!hasPurpose) flags.push(MISSING[1]);
  if (!hasTimeline) flags.push(MISSING[2]);
  if (!attested) flags.push(MISSING[3]);
  // Operator-entered preview flags are NOT a substitute for a server-side safety review.
  if (input.threatOrHarassment === true) flags.push('safety_escalation');
  if (input.requestsPrivateInformation === true) flags.push('privacy_escalation');
  if (input.requiresLegalReview === true) flags.push('jurisdiction_review');
  if (input.requestsUnapprovedOffer === true) flags.push('unapproved_offer');
  const safety = flags.includes('safety_escalation') || flags.includes('privacy_escalation');
  const review = safety || flags.includes('jurisdiction_review') || flags.includes('unapproved_offer');
  const complete = validContact && hasPurpose && hasTimeline && attested;
  const disposition = safety ? 'safety_review' : review ? 'human_review'
    : complete ? 'qualified_for_human_review' : 'needs_information';
  return {
    channel, category, disposition, contactValid: validContact,
    adultAttestationOnly: attested, flags, missing: flags.filter(f => MISSING.includes(f)),
    authorizedActions: safety ? ['queue_for_human'] : ['draft_response', 'queue_for_human'],
    automaticBookingAllowed: false, automaticPriceQuoteAllowed: false,
    recordingAllowed: false, voiceCloningAllowed: false,
  };
}
