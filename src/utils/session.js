const sessions = new Map();

export function setSession(userId, data) {
  sessions.set(String(userId), { ...data, updatedAt: Date.now() });
}

export function getSession(userId) {
  return sessions.get(String(userId));
}

export function updateSession(userId, patch) {
  const current = getSession(userId) || {};
  setSession(userId, { ...current, ...patch });
}

export function clearSession(userId) {
  sessions.delete(String(userId));
}

export function isSessionExpired(session, ms = 30 * 60 * 1000) {
  return !session || Date.now() - session.updatedAt > ms;
}
