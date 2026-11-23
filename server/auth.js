import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { HttpError } from './errors.js';

const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 30 * 1000;

export function createSettings(db) {
  return {
    get: (key) => db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value ?? null,
    set: (key, value) => db.prepare(
      'INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    ).run(key, value),
    del: (key) => db.prepare('DELETE FROM settings WHERE key=?').run(key),
  };
}

export function createAuth(settings) {
  const sessions = new Map();
  let fails = 0;
  let lockedUntil = 0;

  const hash = (pin, salt) => scryptSync(pin, salt, 32);
  const hasPin = () => settings.get('pin_hash') !== null;

  function verify(pin) {
    if (Date.now() < lockedUntil) throw new HttpError(429, 'Muitas tentativas. Aguarde alguns segundos.');
    const salt = settings.get('pin_salt');
    const expected = Buffer.from(settings.get('pin_hash') ?? '', 'hex');
    const given = salt ? hash(String(pin ?? ''), salt) : Buffer.alloc(0);
    const ok = expected.length > 0 && given.length === expected.length && timingSafeEqual(given, expected);
    if (!ok) {
      fails += 1;
      if (fails >= MAX_FAILS) { fails = 0; lockedUntil = Date.now() + LOCK_MS; }
      throw new HttpError(401, 'PIN incorreto');
    }
    fails = 0;
  }

  function setPin(pin) {
    if (!/^\d{4,8}$/.test(String(pin ?? ''))) throw new HttpError(400, 'O PIN deve ter de 4 a 8 dígitos');
    const salt = randomBytes(16).toString('hex');
    settings.set('pin_salt', salt);
    settings.set('pin_hash', hash(String(pin), salt).toString('hex'));
    sessions.clear();
  }

  function removePin() {
    settings.del('pin_salt');
    settings.del('pin_hash');
    sessions.clear();
  }

  function issue() {
    const token = randomBytes(24).toString('hex');
    sessions.set(token, Date.now() + SESSION_MS);
    return token;
  }

  function valid(token) {
    const exp = sessions.get(token);
    if (!exp) return false;
    if (exp < Date.now()) { sessions.delete(token); return false; }
    return true;
  }

  return { hasPin, verify, setPin, removePin, issue, valid, revoke: (t) => sessions.delete(t) };
}
