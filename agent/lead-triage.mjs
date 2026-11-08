/**
 * Ellie May concierge: bounded, deterministic enquiry triage.
 * No raw message text is saved or returned; this is not an age-verification system.
 */
const VALID_CHANNELS = new Set(["web", "phone", "email"]);
const VALID_CATEGORIES = new Set(["general", "media", "collaboration", "technical", "other"]);
const EMAIL = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const PHONE = /^\\+?[0-9 ()-]{8,24}$/;

export function triageEnquiry(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Enquiry must be an object");
  }
  const channel = VALID_CHANNELS.has(input.channel) ? input.channel : "web";
  const category = VALID_CATEGORIES.has(input.category) ? input.category : "other";
  const contact = typeof input.contact === "string" ? input.contact.trim() : "";
  const validContact = EMAIL.test(contact) || PHONE.test(contact);
  const hasPurpose = typeof input.purpose === "string" && input.purpose.trim().length >= 12;
  const hasTimeline = typeof input.timeline === "string" && input.timeline.trim().length > 0;
  const explicitAdultAttestation = input.adultAttested === true;
  const flags = [];
  if (!validContact) flags.push("missing_or_invalid_contact");
  if (!hasPurpose) flags.push("missing_purpose");
  if (!hasTimeline) flags.push("missing_timeline");
  if (!explicitAdultAttestation) flags.push("adult_status_unconfirmed");
  if (input.threatOrHarassment === true) flags.push("safety_escalation");
  if (input.requestsPrivateInformation === true) flags.push("privacy_escalation");
  if (input.requiresLegalReview === true) flags.push("jurisdiction_review");
  if (input.requestsUnapprovedOffer === true) flags.push("unapproved_offer");
  const safety = flags.includes("safety_escalation") || flags.includes("privacy_escalation");
  const review = safety || flags.includes("jurisdiction_review") || flags.includes("unapproved_offer");
  const ready = validContact && hasPurpose && hasTimeline && explicitAdultAttestation;
  const disposition = safety ? "safety_review" : review ? "human_review"
    : ready ? "qualified_for_human_review" : "needs_information";
  return {
    channel, category, disposition,
    contactValid: validContact,
    adultAttestationOnly: explicitAdultAttestation,
    // Human staff must decide on priority and actual legitimacy.
    flags,
    missing: flags.filter(f => ["missing_or_invalid_contact","missing_purpose","missing_timeline","adult_status_unconfirmed"].includes(f)),
    authorizedActions: ["draft_response", "queue_for_human"],
    automaticBookingAllowed: false,
    automaticPriceQuoteAllowed: false,
    recordingAllowed: false,
    voiceCloningAllowed: false
  };
}
