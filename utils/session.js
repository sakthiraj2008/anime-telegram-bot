import { SESSION_TIMEOUT_MS } from '../config.js';

// One active operation per admin. Keyed by Telegram userId.
// Shape:
// {
//   userId, type ('create'|'upload'|'edit'|'delete'),
//   step, contentType ('anime'|'movie'|'series'),
//   contentId, temporaryData: {}, createdAt
// }
const sessions = new Map();

export function createSession(userId, type, extra = {}) {
  const session = {
    userId,
    type,
    step: 0,
    contentType: null,
    contentId: null,
    temporaryData: {},
    createdAt: Date.now(),
    ...extra,
  };
  sessions.set(userId, session);
  return session;
}

export function getSession(userId) {
  const session = sessions.get(userId);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TIMEOUT_MS) {
    sessions.delete(userId);
    return null;
  }
  return session;
}

// Merge a patch into the session and refresh its activity timestamp so an
// admin actively working through a wizard never gets timed out mid-flow.
export function updateSession(userId, patch) {
  const session = sessions.get(userId);
  if (!session) return null;
  Object.assign(session, patch);
  session.createdAt = Date.now();
  sessions.set(userId, session);
  return session;
}

export function clearSession(userId) {
  sessions.delete(userId);
}

export function hasActiveSession(userId) {
  return getSession(userId) !== null;
}
