/** Creator-specific operator access. No allowlist means no access, including in development. */
export function canAccessConcierge(userId, allowedIds = '') {
  if (typeof userId !== 'string' || !userId || typeof allowedIds !== 'string') return false;
  const ids = allowedIds.split(',').map(id => id.trim()).filter(Boolean);
  return ids.length > 0 && ids.includes(userId);
}
