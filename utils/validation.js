export function isValidUrl(str) {
  if (typeof str !== 'string') return false;
  try {
    const u = new URL(str.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidYear(str) {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (!/^\d{4}$/.test(trimmed)) return false;
  const year = Number(trimmed);
  return year >= 1900 && year <= 2100;
}

export function isValidImdb(str) {
  if (typeof str !== 'string') return false;
  const n = Number(str.trim());
  return !Number.isNaN(n) && n >= 0 && n <= 10;
}

export function parseGenres(str) {
  if (typeof str !== 'string') return [];
  return str
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
}

export function isPositiveInteger(str) {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  return /^\d+$/.test(trimmed) && Number(trimmed) > 0;
}

export function isNonEmpty(str) {
  return typeof str === 'string' && str.trim().length > 0;
}

export const VALID_STATUSES = ['Ongoing', 'Completed', 'Upcoming'];
export const VALID_TYPES = ['anime', 'movie', 'series'];

export function isValidContentType(type) {
  return VALID_TYPES.includes(type);
}
