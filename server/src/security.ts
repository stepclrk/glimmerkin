import { createHash, randomBytes, randomInt } from 'node:crypto';
import argon2 from 'argon2';

export const SESSION_COOKIE = 'gk_session';
export const SESSION_DAYS = 30;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

/** A made-up name: 3 to 20 letters, numbers or underscores. */
export function validUsername(value: unknown): value is string {
  return typeof value === 'string' && USERNAME.test(value);
}

export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX;
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/** Verified when a username does not exist, so a wrong name takes as long to refuse as a wrong password. */
let decoy: Promise<string> | undefined;
export function decoyHash(): Promise<string> {
  decoy ??= hashPassword(randomBytes(16).toString('hex'));
  return decoy;
}

/** A session token for the cookie. Only its hash is stored. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const WORDS = ['MOSS', 'EMBR', 'TIDE', 'GALE', 'GLOW', 'FERN', 'DUSK', 'DAWN', 'MIST', 'REED', 'LARK', 'WREN',
  'PINE', 'SAGE', 'OPAL', 'ONYX', 'RUNE', 'STAR', 'MOON', 'NEST', 'PUFF', 'WISP', 'FAWN', 'KELP',
  'ROOK', 'SEED', 'VALE', 'COVE', 'PEAK', 'BRAE', 'HAZE', 'LOAM'];

function pickWord(): string {
  return WORDS[randomInt(WORDS.length)] as string;
}

function digits(n: number): string {
  return String(randomInt(10 ** n)).padStart(n, '0');
}

/** An invite code such as MOSS-4821. */
export function newInviteCode(): string {
  return `${pickWord()}-${digits(4)}`;
}

/** Tidy what someone typed: codes are stored in capitals. */
export function normaliseInviteCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{4}-[0-9]{4}$/.test(code) ? code : null;
}

/** A one-time password the owner reads out or sends on, such as moss-wren-dusk-4821. */
export function newOneTimePassword(): string {
  return `${pickWord()}-${pickWord()}-${pickWord()}-${digits(4)}`.toLowerCase();
}

/** Counts events per key inside a moving window. Held in memory: one server, and a restart only forgives. */
export class Limiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly max: number, private readonly windowMs: number, private readonly now: () => number = Date.now) {}

  private recent(key: string): number[] {
    const since = this.now() - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (list.length) this.hits.set(key, list); else this.hits.delete(key);
    return list;
  }

  blocked(key: string): boolean {
    return this.recent(key).length >= this.max;
  }

  hit(key: string): void {
    const list = this.recent(key);
    list.push(this.now());
    this.hits.set(key, list);
    if (this.hits.size > 5000) for (const k of [...this.hits.keys()]) this.recent(k);
  }

  clear(key: string): void {
    this.hits.delete(key);
  }
}
